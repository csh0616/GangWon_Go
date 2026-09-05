// PRD 3.5절 부분 재구성(매니징 자동 트리거 경로) + 3.6절 타임아웃.
// API_CONTRACT.md §3 POST /api/alerts/trigger, POST /api/alerts/:id/respond가 이 모듈을 그대로 쓴다.
// agent/(조건 감시 에이전트)도 자동 스캔으로 day/target_poi_id를 찾은 뒤 동일 함수를 재사용한다
// (PRD 3.6절 "같은 스코어링 로직" — 로직 중복 방지).
const { supabaseAdmin } = require('../config/supabaseClient');
const { adjustWeightsForCondition } = require('./alertAdjust');
const { filterByRelationship, pickTopCandidates } = require('./scoring');
const { filterWithinDuration } = require('./directions');
const { twoOptOptimize } = require('./geo');

const TRAFFIC_RADIUS_SECONDS = 15 * 60;
const TIMEOUT_MINUTES = 3;

function buildMessage(condition, prevName, candName) {
  if (condition === 'rain') {
    return {
      en: `It's raining. Replace ${prevName} with ${candName}?`,
      zh: `下雨了,要把"${prevName}"换成"${candName}"吗?`,
    };
  }
  if (condition === 'traffic') {
    return {
      en: `Heavy traffic ahead. Replace ${prevName} with ${candName}?`,
      zh: `路上比较堵,要把"${prevName}"换成"${candName}"吗?`,
    };
  }
  if (condition === 'festival_cancelled') {
    return {
      en: `${prevName} has been cancelled. Replace with ${candName}?`,
      zh: `"${prevName}"活动已取消,要换成"${candName}"吗?`,
    };
  }
  return { en: `Replace ${prevName} with ${candName}?`, zh: null };
}

/**
 * @param {object} params
 * @param {string} params.itineraryId
 * @param {'weather'|'traffic'|'festival'} params.triggerType
 * @param {'rain'|'traffic'|'festival_cancelled'} params.condition
 * @param {number} params.day
 * @param {string} params.targetPoiId - 교체 대상 스탑 (previous_poi_id)
 */
async function createProposedAlert({ itineraryId, triggerType, condition, day, targetPoiId }) {
  // 중복 방지 (PRD 3.5절/API_CONTRACT.md §3) — 같은 조합으로 이미 proposed면 재-push 없이 그대로 반환
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('alerts')
    .select('*')
    .eq('itinerary_id', itineraryId)
    .eq('day', day)
    .eq('previous_poi_id', targetPoiId)
    .eq('status', 'proposed')
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing) return { alert: existing, isDuplicate: true };

  const { data: itinerary, error: itnErr } = await supabaseAdmin
    .from('itineraries')
    .select('*')
    .eq('id', itineraryId)
    .single();
  if (itnErr) throw itnErr;

  const dayEntry = itinerary.itinerary_json.days.find((d) => d.day === day);
  if (!dayEntry) throw new Error(`day ${day}를 itinerary_json에서 찾을 수 없습니다.`);
  const stopIndex = dayEntry.stops.findIndex((s) => s.poi_id === targetPoiId);
  if (stopIndex === -1) throw new Error(`target_poi_id ${targetPoiId}를 day ${day}에서 찾을 수 없습니다.`);
  const previousStop = dayEntry.stops[stopIndex];

  const allUsedPoiIds = itinerary.itinerary_json.days.flatMap((d) => d.stops.map((s) => s.poi_id));
  const regionCode = itinerary.region_codes[0];

  const { data: regionPois, error: poisErr } = await supabaseAdmin.from('pois').select('*').eq('region_code', regionCode);
  if (poisErr) throw poisErr;

  let candidatePool = filterByRelationship(regionPois, itinerary.relationship).filter((p) => !allUsedPoiIds.includes(p.id));

  let weights = itinerary.preference_weights;

  if (condition === 'festival_cancelled') {
    // 해당 festival_event POI 1건만 후보에서 제외 (다른 카테고리 영향 없음, PRD 3.5절 조정표)
    candidatePool = candidatePool.filter((p) => p.id !== targetPoiId);
  } else if (condition === 'traffic') {
    // 카테고리 조정 아님 — 교체 대상 바로 이전 스탑(없으면 대상 자신) 좌표 기준 15분 이내로 거리 필터 (PRD 3.5절)
    const referenceStop = stopIndex > 0 ? dayEntry.stops[stopIndex - 1] : previousStop;
    candidatePool = await filterWithinDuration(referenceStop, candidatePool, TRAFFIC_RADIUS_SECONDS);
  } else {
    weights = adjustWeightsForCondition(weights, condition);
  }

  const [topCandidate] = pickTopCandidates(candidatePool, weights, { limit: 1 });
  if (!topCandidate) {
    throw new Error('대체 후보를 찾지 못했습니다 (조건에 맞는 POI가 없음).');
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('alerts')
    .insert({
      itinerary_id: itineraryId,
      trigger_type: triggerType,
      condition,
      status: 'proposed',
      day,
      previous_poi_id: targetPoiId,
      proposed_poi_id: topCandidate.id,
      triggered_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (insertErr) throw insertErr;

  return {
    alert: inserted,
    isDuplicate: false,
    message: buildMessage(condition, previousStop.name, topCandidate.name),
    proposedStop: {
      day,
      previous_poi_id: targetPoiId,
      candidate_poi: {
        poi_id: topCandidate.id,
        name: topCandidate.name,
        category: topCandidate.category,
        lat: topCandidate.lat,
        lng: topCandidate.lng,
      },
    },
  };
}

/**
 * Yes/No 응답 처리 (API_CONTRACT.md §3 POST /api/alerts/:id/respond). 실제 적용은 여기서만 일어난다.
 */
async function respondToAlert({ alertId, response }) {
  const { data: alert, error: alertErr } = await supabaseAdmin.from('alerts').select('*').eq('id', alertId).single();
  if (alertErr) throw alertErr;
  if (alert.status !== 'proposed') {
    throw new Error(`alert ${alertId}는 이미 ${alert.status} 상태입니다.`);
  }

  if (response === 'no') {
    const { data: updated, error } = await supabaseAdmin
      .from('alerts')
      .update({ status: 'dismissed', responded_at: new Date().toISOString() })
      .eq('id', alertId)
      .select()
      .single();
    if (error) throw error;
    return { status: 'dismissed', alert: updated };
  }

  const { data: itinerary, error: itnErr } = await supabaseAdmin.from('itineraries').select('*').eq('id', alert.itinerary_id).single();
  if (itnErr) throw itnErr;

  const { data: candidatePoi, error: poiErr } = await supabaseAdmin.from('pois').select('*').eq('id', alert.proposed_poi_id).single();
  if (poiErr) throw poiErr;

  const days = itinerary.itinerary_json.days.map((d) => {
    if (d.day !== alert.day) return d;
    const replacedStops = d.stops.map((s) =>
      s.poi_id === alert.previous_poi_id
        ? { poi_id: candidatePoi.id, name: candidatePoi.name, category: candidatePoi.category, lat: candidatePoi.lat, lng: candidatePoi.lng }
        : s
    );
    const reordered = twoOptOptimize(replacedStops, { pinFirst: false });
    return { ...d, stops: reordered.map((s, i) => ({ ...s, order: i + 1 })) };
  });

  const newItineraryJson = { ...itinerary.itinerary_json, days };

  const { error: updateItnErr } = await supabaseAdmin.from('itineraries').update({ itinerary_json: newItineraryJson }).eq('id', itinerary.id);
  if (updateItnErr) throw updateItnErr;

  const { data: updatedAlert, error: updateAlertErr } = await supabaseAdmin
    .from('alerts')
    .update({ status: 'confirmed', responded_at: new Date().toISOString() })
    .eq('id', alertId)
    .select()
    .single();
  if (updateAlertErr) throw updateAlertErr;

  return { status: 'confirmed', alert: updatedAlert, updated_stop: { poi_id: candidatePoi.id, day: alert.day } };
}

/**
 * PRD 3.6절 — 3분 무응답 자동 dismiss. responded_at은 NULL로 남겨 실제 No 클릭과 구분한다.
 * 조건 감시 에이전트(5~10분 cron)가 매 주기 같이 실행 (agent/src/monitor.js).
 */
async function dismissExpiredProposals() {
  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('alerts')
    .update({ status: 'dismissed' })
    .eq('status', 'proposed')
    .lt('triggered_at', cutoff)
    .select();
  if (error) throw error;
  return data;
}

module.exports = { createProposedAlert, respondToAlert, dismissExpiredProposals };
