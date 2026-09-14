const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { requireAuth } = require('../middleware/auth');
const { apiError } = require('../middleware/errorHandler');
const { REGION_CODES, RELATIONSHIP_ENUM } = require('../lib/categories');
const {
  filterByRelationship,
  buildItineraryDays,
  pickTopCandidates,
  dateForDayIndex,
  festivalOverlapsDate,
  addDaysToDateString,
  toCandidateShape,
} = require('../lib/scoring');
const { extractPreferenceWeights, extractStopWeights, generateNarrationBundle, generateCandidateBlurbs } = require('../lib/llm');
const { selectRegionsForAuto, assignRegionsToDayBlocks } = require('../lib/regionSelect');
const { fillTravelFromPrev, fillTravelBetweenDays } = require('../lib/travel');
const { twoOptOptimize } = require('../lib/geo');
const { validateTripDates, isValidCompanions, isValidItineraryJson } = require('../lib/validators');

const router = express.Router();

// 라운드5 【4】 — 서비스 기본 언어가 한국어라 ko도 정식 지원 언어에 추가 (API_CONTRACT.md §0).
function validLang(lang) {
  return lang === 'ko' || lang === 'en' || lang === 'zh';
}

// POST /api/itineraries/generate — 게스트 가능 (API_CONTRACT.md §1)
router.post('/generate', async (req, res, next) => {
  try {
    const {
      start_date: startDate,
      end_date: endDate,
      companions,
      relationship,
      free_text: freeText,
      region_codes: rawRegionCodes,
      lang,
    } = req.body;

    if (!validLang(lang)) {
      throw apiError(400, 'INVALID_LANG', 'lang은 ko/en/zh만 지원합니다.');
    }
    if (!startDate || !endDate || !companions || !relationship) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'start_date/end_date/companions/relationship은 필수입니다.');
    }
    if (!RELATIONSHIP_ENUM.includes(relationship)) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', `relationship은 ${RELATIONSHIP_ENUM.join('|')} 중 하나여야 합니다.`);
    }
    if (!isValidCompanions(companions)) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'companions는 1 이상의 정수여야 합니다.');
    }
    const dateCheck = validateTripDates(startDate, endDate);
    if (!dateCheck.valid) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', dateCheck.reason);
    }
    const tripDays = dateCheck.days;

    // region_codes — 다중 시군(1~3) 또는 빈 배열("어디든지", 라운드5 【6】, API_CONTRACT.md §1).
    if (!Array.isArray(rawRegionCodes)) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'region_codes는 배열이어야 합니다 (빈 배열 = 어디든지).');
    }
    const regionCodes = [...new Set(rawRegionCodes)];
    if (regionCodes.some((r) => !REGION_CODES.includes(r))) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', `region_codes는 ${REGION_CODES.join('|')} 중에서만 선택할 수 있습니다.`);
    }
    const isAutoRegion = regionCodes.length === 0;
    // 빈 배열인데 free_text도 없으면 가중치를 전혀 뽑을 수 없어 시군을 고를 근거가 없다 (§1).
    if (isAutoRegion && !(freeText && freeText.trim())) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', '어디든지(빈 region_codes)를 쓰려면 free_text가 있어야 합니다.');
    }
    if (!isAutoRegion && regionCodes.length > tripDays) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'region_codes는 여행 일수보다 많을 수 없습니다.');
    }

    const { weights, activity_level: activityLevel } = await extractPreferenceWeights(freeText);

    // "어디든지"일 땐 3개 시군 전체 POI로 점수를 매겨야 하므로 미리 다 불러온다 (regionSelect.js).
    const poolRegionCodes = isAutoRegion ? REGION_CODES : regionCodes;
    const { data: pois, error: poisErr } = await supabaseAdmin.from('pois').select('*').in('region_code', poolRegionCodes);
    if (poisErr) throw poisErr;

    let finalRegionCodes = regionCodes;
    if (isAutoRegion) {
      if (pois.length === 0) {
        throw apiError(404, 'NO_POI_DATA', '사용 가능한 POI 데이터가 없습니다.');
      }
      finalRegionCodes = selectRegionsForAuto(pois, weights, tripDays);
    } else {
      const missingRegion = regionCodes.find((r) => !pois.some((p) => p.region_code === r));
      if (missingRegion) {
        throw apiError(404, 'NO_POI_DATA', `${missingRegion}에 사용 가능한 POI 데이터가 없습니다.`);
      }
    }

    // 다중 시군 날짜 배정(PRD 3.5절 2.5단계) — 위도 내림차순으로 연속 날짜 블록에 배정한 뒤, 블록별로
    // 기존 단일 시군 파이프라인(buildItineraryDays)을 그대로 재사용한다. 인제↔평창처럼 먼 시군을
    // 한 풀에 넣고 k-means를 돌리지 않기 위해서다 (§1 "왜 좌표 기반 클러스터링이 아니라 날짜 배정인가").
    const blocks = assignRegionsToDayBlocks(finalRegionCodes, tripDays);

    let days = [];
    blocks.forEach((block) => {
      const regionPois = filterByRelationship(
        pois.filter((p) => p.region_code === block.region_code),
        relationship
      );
      const blockStartDate = addDaysToDateString(startDate, block.dayOffset);
      const blockEndDate = addDaysToDateString(startDate, block.dayOffset + block.count - 1);
      const blockDays = buildItineraryDays({
        pois: regionPois,
        weights,
        activityLevel,
        startDate: blockStartDate,
        endDate: blockEndDate,
        dayNumberOffset: block.dayOffset,
        regionCode: block.region_code,
      });
      days = days.concat(blockDays);
    });

    // 일부 날짜만 비는 건 정상(§1 days 불변식)이지만, 전체 스탑 합계가 0이면 후보가 아예 없는 것
    // 이므로 200으로 빈 코스를 주지 않고 NO_CANDIDATE로 막는다 (라운드3 점검 #5와 동일 원칙).
    const totalStops = days.reduce((sum, d) => sum + d.stops.length, 0);
    if (totalStops === 0) {
      throw apiError(404, 'NO_CANDIDATE', '조건에 맞는 POI 후보가 없습니다.');
    }

    // 코스 요약 + 지역 선택 이유 + 스탑별 한 줄 설명을 한 번의 LLM 호출로 받는다 (라운드5 【4】).
    const { narration, regionReason, blurbsByPoiId } = await generateNarrationBundle({
      days,
      isAutoRegion,
      regionCodes: finalRegionCodes,
    });
    days = days.map((d) => ({
      ...d,
      stops: d.stops.map((s) => ({ ...s, blurb: blurbsByPoiId.get(s.poi_id) || null })),
    }));

    // 카카오모빌리티로 스탑 간/시군 간 실제 이동시간을 채운다 (라운드5 【7】, 시간 부족 시 1순위 컷 대상).
    // 날짜별 스탑 채움은 서로 독립적이라 병렬로 처리한다(순차 await는 3초 예산을 크게 넘겼음 — 실측 로그 참고).
    const stopsPerDay = await Promise.all(days.map((d) => fillTravelFromPrev(d.stops)));
    days = days.map((d, i) => ({ ...d, stops: stopsPerDay[i] }));
    days = await fillTravelBetweenDays(days);

    res.status(200).json({
      data: {
        itinerary_json: { days, narration, region_reason: regionReason },
        selected_regions: { auto: isAutoRegion, region_codes: finalRegionCodes },
        preference_weights: weights,
        generated_at: new Date().toISOString(),
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/itineraries — 저장 (로그인 필요, API_CONTRACT.md §2)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      itinerary_json: itineraryJson,
      preference_weights: preferenceWeights,
      region_codes: regionCodes,
      start_date: startDate,
      end_date: endDate,
      companions,
      relationship,
      lang,
    } = req.body;

    if (
      !Array.isArray(regionCodes) ||
      regionCodes.length < 1 ||
      regionCodes.length > 3 ||
      regionCodes.some((r) => !REGION_CODES.includes(r))
    ) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'region_codes는 1~3개의 유효한 시군 코드여야 합니다.');
    }
    if (!itineraryJson || !preferenceWeights || !startDate || !endDate || !companions || !relationship) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', '필수 필드가 누락되었습니다.');
    }
    if (!RELATIONSHIP_ENUM.includes(relationship)) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', `relationship은 ${RELATIONSHIP_ENUM.join('|')} 중 하나여야 합니다.`);
    }
    if (!isValidCompanions(companions)) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'companions는 1 이상의 정수여야 합니다.');
    }
    const dateCheck = validateTripDates(startDate, endDate);
    if (!dateCheck.valid) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', dateCheck.reason);
    }
    // itinerary_json.days 구조 검증 — 저장 시점에 막아야 감시 에이전트가 안전하다 (1주차 점검 #8).
    if (!isValidItineraryJson(itineraryJson)) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'itinerary_json.days 구조가 올바르지 않습니다 (day/stops[].poi_id 필요).');
    }

    // PRD 3.9절 — public.users upsert (없으면 생성, 있으면 유지) 후 같은 트랜잭션 의미로 itineraries insert.
    // lang(선택)은 첫 저장 시점에만 preferred_lang으로 기록 — API_CONTRACT.md §2엔 아직 없는 필드라
    // HANDOFF_LOG.md에 계약 보정 제안으로 남긴다 (1주차 점검 #18).
    const userRow = { id: req.user.id, auth_provider: 'google' };
    if (validLang(lang)) userRow.preferred_lang = lang;
    const { error: userErr } = await supabaseAdmin.from('users').upsert(userRow, { onConflict: 'id', ignoreDuplicates: true });
    if (userErr) throw userErr;

    const { data: itinerary, error: itnErr } = await supabaseAdmin
      .from('itineraries')
      .insert({
        user_id: req.user.id,
        region_codes: regionCodes,
        start_date: startDate,
        end_date: endDate,
        companions,
        relationship,
        status: 'active',
        itinerary_json: itineraryJson,
        preference_weights: preferenceWeights,
      })
      .select()
      .single();
    if (itnErr) throw itnErr;

    res.status(201).json({ data: { itinerary_id: itinerary.id, status: itinerary.status, user_id: req.user.id }, error: null });
  } catch (err) {
    next(err);
  }
});

// GET /api/itineraries — 마이페이지 목록 (신규, 라운드5 【5】, API_CONTRACT.md §2)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    // P0 — service_role 클라이언트는 RLS가 적용되지 않으므로 반드시 auth.uid()로 직접 스코핑한다
    // (1주차 점검 #1에서 GET /:id에 지적했던 것과 동일한 IDOR 패턴).
    const { data, error } = await supabaseAdmin
      .from('itineraries')
      .select('id, region_codes, start_date, end_date, companions, relationship, status, created_at, itinerary_json')
      .eq('user_id', req.user.id)
      .neq('status', 'cancelled')
      .order('start_date', { ascending: false });
    if (error) throw error;

    // itinerary_json 전체는 내려주지 않는다 — 목록 화면엔 스탑 수만 필요하다 (§2).
    const itineraries = data.map((it) => ({
      id: it.id,
      region_codes: it.region_codes,
      start_date: it.start_date,
      end_date: it.end_date,
      companions: it.companions,
      relationship: it.relationship,
      stop_count: (it.itinerary_json?.days || []).reduce((sum, d) => sum + (d.stops?.length || 0), 0),
      status: it.status,
      created_at: it.created_at,
    }));

    res.status(200).json({ data: { itineraries }, error: null });
  } catch (err) {
    next(err);
  }
});

// GET /api/itineraries/:id — 본인 소유만 (API_CONTRACT.md §2)
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data: itinerary, error } = await supabaseAdmin
      .from('itineraries')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!itinerary) throw apiError(404, 'NOT_FOUND', '일정을 찾을 수 없습니다.');
    res.status(200).json({ data: itinerary, error: null });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/itineraries/:id — 마이페이지 삭제, 소프트 삭제 (신규, 라운드5 【5】, API_CONTRACT.md §2)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data: itinerary, error: fetchErr } = await supabaseAdmin
      .from('itineraries')
      .select('id, user_id, status')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!itinerary) throw apiError(404, 'NOT_FOUND', '일정을 찾을 수 없습니다.');
    // §2 DELETE 전용 규칙 — 본인 소유가 아니면 403 (다른 엔드포인트의 "존재 자체를 숨기는 404" 원칙과
    // 다르게, 이 엔드포인트는 계약에 403을 명시했다).
    if (itinerary.user_id !== req.user.id) throw apiError(403, 'FORBIDDEN', '본인 소유의 일정만 삭제할 수 있습니다.');

    // 이미 cancelled인 id를 다시 호출해도 같은 200을 준다 (멱등, §2).
    if (itinerary.status !== 'cancelled') {
      const { error: updateErr } = await supabaseAdmin.from('itineraries').update({ status: 'cancelled' }).eq('id', itinerary.id);
      if (updateErr) throw updateErr;
    }

    res.status(200).json({ data: { id: itinerary.id, status: 'cancelled' }, error: null });
  } catch (err) {
    next(err);
  }
});

// POST /api/itineraries/regenerate-stop — 수동 편집 전용 (API_CONTRACT.md §3)
router.post('/regenerate-stop', requireAuth, async (req, res, next) => {
  try {
    const { itinerary_id: itineraryId, day, target_poi_id: targetPoiId, free_text: freeText } = req.body;
    if (!itineraryId || !day || !targetPoiId) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'itinerary_id/day/target_poi_id는 필수입니다.');
    }

    const { data: itinerary, error: itnErr } = await supabaseAdmin
      .from('itineraries')
      .select('*')
      .eq('id', itineraryId)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (itnErr) throw itnErr;
    if (!itinerary) throw apiError(404, 'NOT_FOUND', '일정을 찾을 수 없습니다.');

    const dayEntry = itinerary.itinerary_json.days.find((d) => d.day === day);
    if (!dayEntry) throw apiError(404, 'STOP_NOT_FOUND', `day ${day}를 찾을 수 없습니다.`);
    if (!dayEntry.stops.some((s) => s.poi_id === targetPoiId)) {
      throw apiError(404, 'STOP_NOT_FOUND', `target_poi_id를 day ${day}에서 찾을 수 없습니다.`);
    }

    // free_text 실패 시 저장된 preference_weights로 폴백 (전부 0 아님 — /generate 전용 정책과 다름, 1주차 점검 #18)
    const weights = await extractStopWeights(freeText, itinerary.preference_weights);

    const allUsedPoiIds = itinerary.itinerary_json.days.flatMap((d) => d.stops.map((s) => s.poi_id));
    // 다중 시군 지원(라운드5 【6】) — itinerary.region_codes[0]이 아니라 실제 대상 스탑이 속한
    // 날짜의 region_code를 써야 한다(그 날이 어느 시군에 배정됐는지는 시군마다 다를 수 있음).
    const regionCode = dayEntry.region_code;

    const { data: regionPois, error: poisErr } = await supabaseAdmin.from('pois').select('*').eq('region_code', regionCode);
    if (poisErr) throw poisErr;

    let candidatePool = filterByRelationship(regionPois, itinerary.relationship).filter((p) => !allUsedPoiIds.includes(p.id));

    // 축제 날짜 필터 재적용 — 그 날짜가 아닌 festival_event는 후보에서 제외 (PRD 3.5절, 1주차 점검 #11)
    const targetDate = dateForDayIndex(itinerary.start_date, day - 1);
    candidatePool = candidatePool.filter((p) => {
      if (!(p.tags || []).includes('festival_event')) return true;
      return festivalOverlapsDate(p, targetDate);
    });

    const candidates = pickTopCandidates(candidatePool, weights, { limit: 3 });
    if (candidates.length === 0) {
      throw apiError(404, 'NO_CANDIDATE', '조건에 맞는 대체 후보가 없습니다.');
    }

    // 후보 각각에 40자 이내 한 줄 설명을 붙인다 (라운드5 【4】, API_CONTRACT.md §3 candidates[].blurb).
    const blurbsByPoiId = await generateCandidateBlurbs(candidates.map((c) => ({ id: c.id, name: c.name, category: c.category })));

    res.status(200).json({
      data: {
        candidates: candidates.map((c) => ({ ...toCandidateShape(c), blurb: blurbsByPoiId.get(c.id) || null })),
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/itineraries/:id — 수동 편집 확정 (API_CONTRACT.md §3)
// 주의: API_CONTRACT.md v0 초안엔 target_poi_id가 빠져있음 — 하루에 스탑이 여러 개면 new_poi_id만으로는
// "어느 스탑을 교체하는지" 알 수 없어 target_poi_id를 필수로 추가했다 (PM 반영 완료, PR #3).
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { day, target_poi_id: targetPoiId, new_poi_id: newPoiId } = req.body;
    if (!day || !targetPoiId || !newPoiId) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'day/target_poi_id/new_poi_id는 필수입니다.');
    }

    const { data: itinerary, error: itnErr } = await supabaseAdmin
      .from('itineraries')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (itnErr) throw itnErr;
    if (!itinerary) throw apiError(404, 'NOT_FOUND', '일정을 찾을 수 없습니다.');

    // day/target_poi_id가 실제로 일정에 없으면 조용히 200을 반환하지 않고 STOP_NOT_FOUND (1주차 점검 #18)
    const dayEntry = itinerary.itinerary_json.days.find((d) => d.day === day);
    if (!dayEntry) throw apiError(404, 'STOP_NOT_FOUND', `day ${day}를 찾을 수 없습니다.`);
    if (!dayEntry.stops.some((s) => s.poi_id === targetPoiId)) {
      throw apiError(404, 'STOP_NOT_FOUND', `target_poi_id를 day ${day}에서 찾을 수 없습니다.`);
    }

    // .single()이면 존재하지 않는 new_poi_id일 때 500이 난다 — §0.1 기준 404 NOT_FOUND가 맞다 (라운드2 점검 #6)
    const { data: newPoi, error: poiErr } = await supabaseAdmin.from('pois').select('*').eq('id', newPoiId).maybeSingle();
    if (poiErr) throw poiErr;
    if (!newPoi) throw apiError(404, 'NOT_FOUND', '새 POI를 찾을 수 없습니다.');

    // 새 스탑의 40자 한 줄 설명도 함께 생성 (regenerate-stop 후보 화면과 동일한 필드를 확정 후에도 유지).
    const blurbsByPoiId = await generateCandidateBlurbs([{ id: newPoi.id, name: newPoi.name, category: newPoi.category }]);
    const newBlurb = blurbsByPoiId.get(newPoi.id) || null;

    let updatedDayIndex = -1;
    const days = itinerary.itinerary_json.days.map((d, idx) => {
      if (d.day !== day) return d;
      updatedDayIndex = idx;
      const replaced = d.stops.map((s) =>
        s.poi_id === targetPoiId ? { ...toCandidateShape(newPoi), blurb: newBlurb, travel_from_prev: null } : s
      );
      const reordered = twoOptOptimize(replaced, { pinFirst: false });
      return { ...d, stops: reordered.map((s, i) => ({ ...s, order: i + 1 })) };
    });

    // 순서가 바뀌었으니 그 날의 travel_from_prev를 다시 계산한다 (실패 시 travel.js가 필드 전체를 null로 둠).
    if (updatedDayIndex !== -1) {
      days[updatedDayIndex] = { ...days[updatedDayIndex], stops: await fillTravelFromPrev(days[updatedDayIndex].stops) };
    }

    const newItineraryJson = { ...itinerary.itinerary_json, days };
    const { error: updateErr } = await supabaseAdmin.from('itineraries').update({ itinerary_json: newItineraryJson }).eq('id', itinerary.id);
    if (updateErr) throw updateErr;

    res.status(200).json({ data: { itinerary_json: newItineraryJson, day_reordered: true }, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
