const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { requireAuth } = require('../middleware/auth');
const { apiError } = require('../middleware/errorHandler');
const { REGION_CODES, RELATIONSHIP_ENUM } = require('../lib/categories');
const { filterByRelationship, buildItineraryDays, pickTopCandidates } = require('../lib/scoring');
const { extractPreferenceWeights, generateNarration } = require('../lib/llm');
const { twoOptOptimize } = require('../lib/geo');

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

    const regionCode = regionCodes[0];
    const { weights, activity_level: activityLevel } = await extractPreferenceWeights(freeText);

    const { data: regionPois, error: poisErr } = await supabaseAdmin.from('pois').select('*').eq('region_code', regionCode);
    if (poisErr) throw poisErr;

    const filteredPois = filterByRelationship(regionPois, relationship);
    if (filteredPois.length === 0) {
      throw apiError(400, 'NO_POI_DATA', `${regionCode}에 사용 가능한 POI 데이터가 없습니다.`);
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
    const { itinerary_json: itineraryJson, preference_weights: preferenceWeights, region_codes: regionCodes, start_date: startDate, end_date: endDate, companions, relationship } = req.body;

    if (!Array.isArray(regionCodes) || regionCodes.length !== 1 || !REGION_CODES.includes(regionCodes[0])) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'region_codes는 1개 시군 코드만 담아야 합니다.');
    }
    if (!itineraryJson || !preferenceWeights || !startDate || !endDate || !companions || !relationship) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', '필수 필드가 누락되었습니다.');
    }

    // PRD 3.9절 — public.users upsert (없으면 생성, 있으면 유지) 후 같은 트랜잭션 의미로 itineraries insert
    const { error: userErr } = await supabaseAdmin
      .from('users')
      .upsert({ id: req.user.id, auth_provider: 'google' }, { onConflict: 'id', ignoreDuplicates: true });
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
    if (!itinerary) throw apiError(404, 'ITINERARY_NOT_FOUND', '일정을 찾을 수 없습니다.');
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
    if (!itinerary) throw apiError(404, 'ITINERARY_NOT_FOUND', '일정을 찾을 수 없습니다.');

    let weights = itinerary.preference_weights;
    if (freeText && freeText.trim()) {
      const extracted = await extractPreferenceWeights(freeText);
      weights = extracted.weights;
    }

    const allUsedPoiIds = itinerary.itinerary_json.days.flatMap((d) => d.stops.map((s) => s.poi_id));
    const regionCode = itinerary.region_codes[0];

    const { data: regionPois, error: poisErr } = await supabaseAdmin.from('pois').select('*').eq('region_code', regionCode);
    if (poisErr) throw poisErr;

    const candidatePool = filterByRelationship(regionPois, itinerary.relationship).filter((p) => !allUsedPoiIds.includes(p.id));
    const candidates = pickTopCandidates(candidatePool, weights, { limit: 3 });

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
// "어느 스탑을 교체하는지" 알 수 없어 target_poi_id를 필수로 추가했다. HANDOFF_LOG.md에 계약 보정 제안 기록.
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
    if (!itinerary) throw apiError(404, 'ITINERARY_NOT_FOUND', '일정을 찾을 수 없습니다.');

    const { data: newPoi, error: poiErr } = await supabaseAdmin.from('pois').select('*').eq('id', newPoiId).single();
    if (poiErr) throw poiErr;

    let dayReordered = false;
    const days = itinerary.itinerary_json.days.map((d) => {
      if (d.day !== day) return d;
      const replaced = d.stops.map((s) =>
        s.poi_id === targetPoiId ? { poi_id: newPoi.id, name: newPoi.name, category: newPoi.category, lat: newPoi.lat, lng: newPoi.lng } : s
      );
      const reordered = twoOptOptimize(replaced, { pinFirst: false });
      dayReordered = true;
      return { ...d, stops: reordered.map((s, i) => ({ ...s, order: i + 1 })) };
    });

    const newItineraryJson = { ...itinerary.itinerary_json, days };
    const { error: updateErr } = await supabaseAdmin.from('itineraries').update({ itinerary_json: newItineraryJson }).eq('id', itinerary.id);
    if (updateErr) throw updateErr;

    res.status(200).json({ data: { itinerary_json: newItineraryJson, day_reordered: dayReordered }, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
