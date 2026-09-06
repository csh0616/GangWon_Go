const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { requireAuth } = require('../middleware/auth');
const { apiError } = require('../middleware/errorHandler');
const { REGION_CODES, RELATIONSHIP_ENUM } = require('../lib/categories');
const { filterByRelationship, buildItineraryDays, pickTopCandidates, dateForDayIndex, festivalOverlapsDate } = require('../lib/scoring');
const { extractPreferenceWeights, extractStopWeights, generateNarration } = require('../lib/llm');
const { twoOptOptimize } = require('../lib/geo');
const { validateTripDates, isValidCompanions, isValidItineraryJson } = require('../lib/validators');

const router = express.Router();

function validLang(lang) {
  return lang === 'en' || lang === 'zh';
}

// POST /api/itineraries/generate — 게스트 가능 (API_CONTRACT.md §1)
router.post('/generate', async (req, res, next) => {
  try {
    const { start_date: startDate, end_date: endDate, companions, relationship, free_text: freeText, region_codes: regionCodes, lang } = req.body;

    if (!validLang(lang)) {
      throw apiError(400, 'INVALID_LANG', 'lang은 en 또는 zh만 지원합니다.');
    }
    if (!Array.isArray(regionCodes) || regionCodes.length !== 1 || !REGION_CODES.includes(regionCodes[0])) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'region_codes는 1개 시군 코드만 담아야 합니다.');
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

    const regionCode = regionCodes[0];
    const { weights, activity_level: activityLevel } = await extractPreferenceWeights(freeText);

    const { data: regionPois, error: poisErr } = await supabaseAdmin.from('pois').select('*').eq('region_code', regionCode);
    if (poisErr) throw poisErr;
    if (regionPois.length === 0) {
      throw apiError(404, 'NO_POI_DATA', `${regionCode}에 사용 가능한 POI 데이터가 없습니다.`);
    }

    const filteredPois = filterByRelationship(regionPois, relationship);
    if (filteredPois.length === 0) {
      throw apiError(404, 'NO_CANDIDATE', 'relationship 필터를 통과하는 POI가 없습니다.');
    }

    const days = buildItineraryDays({ pois: filteredPois, weights, activityLevel, startDate, endDate });
    const narration = await generateNarration(days);

    res.status(200).json({
      data: {
        itinerary_json: { days, narration },
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

    if (!Array.isArray(regionCodes) || regionCodes.length !== 1 || !REGION_CODES.includes(regionCodes[0])) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'region_codes는 1개 시군 코드만 담아야 합니다.');
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
    const regionCode = itinerary.region_codes[0];

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

    res.status(200).json({
      data: { candidates: candidates.map((c) => ({ poi_id: c.id, name: c.name, category: c.category, lat: c.lat, lng: c.lng })) },
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

    const { data: newPoi, error: poiErr } = await supabaseAdmin.from('pois').select('*').eq('id', newPoiId).single();
    if (poiErr) throw poiErr;

    const days = itinerary.itinerary_json.days.map((d) => {
      if (d.day !== day) return d;
      const replaced = d.stops.map((s) =>
        s.poi_id === targetPoiId ? { poi_id: newPoi.id, name: newPoi.name, category: newPoi.category, lat: newPoi.lat, lng: newPoi.lng } : s
      );
      const reordered = twoOptOptimize(replaced, { pinFirst: false });
      return { ...d, stops: reordered.map((s, i) => ({ ...s, order: i + 1 })) };
    });

    const newItineraryJson = { ...itinerary.itinerary_json, days };
    const { error: updateErr } = await supabaseAdmin.from('itineraries').update({ itinerary_json: newItineraryJson }).eq('id', itinerary.id);
    if (updateErr) throw updateErr;

    res.status(200).json({ data: { itinerary_json: newItineraryJson, day_reordered: true }, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
