// PRD 3.5절 부분 재구성(매니징 자동 트리거 경로) + 3.6절 타임아웃.
// API_CONTRACT.md §3 POST /api/alerts/trigger, POST /api/alerts/:id/respond가 이 모듈을 그대로 쓴다.
// agent/(조건 감시 에이전트)도 자동 스캔으로 day/target_poi_id를 찾은 뒤 동일 함수를 재사용한다
// (PRD 3.6절 "같은 스코어링 로직" — 로직 중복 방지).
const { supabaseAdmin } = require('../config/supabaseClient');
const { apiError } = require('../middleware/errorHandler');
const { filterOutdoorForRain } = require('./alertAdjust');
const { filterByRelationship, pickTopCandidates, dateForDayIndex, festivalOverlapsDate } = require('./scoring');
const { filterWithinDuration } = require('./directions');
const { twoOptOptimize, haversineKm } = require('./geo');

const TRAFFIC_RADIUS_SECONDS = 15 * 60;
// 카카오모빌리티 API가 전부 실패했을 때만 쓰는 Haversine 근사 반경 — 산간지형 평균 주행속도를
// 대략 40km/h로 잡아 15분 이동거리를 역산한 값 (1주차 점검 #7, PRD 6장 폴백 원칙).
const TRAFFIC_FALLBACK_RADIUS_KM = 10;
const TIMEOUT_MINUTES = 3;

// PRD 6장 (1주차 점검) — 알림 문구는 서버가 완성된 문장을 하드코딩하지 않고 다국어 키 + 치환값으로
// 내려보내 프론트가 조립한다. API_CONTRACT.md §3의 기존 예시(완성 문장)는 이 규칙 반영 전 예시라
// HANDOFF_LOG에 갱신 제안을 남긴다.
const MESSAGE_KEY_BY_CONDITION = {
  rain: 'alert.rain',
  traffic: 'alert.traffic',
  festival_cancelled: 'alert.festival_cancelled',
};

// DB의 alert_trigger_type enum과 동일 — 라우트가 잘못된 값을 걸러내는 데 사용 (라운드2 점검 #7).
const ALLOWED_TRIGGER_TYPES = ['weather', 'traffic', 'festival'];
const ALLOWED_CONDITIONS = Object.keys(MESSAGE_KEY_BY_CONDITION);

// trigger_type/condition은 각각은 유효해도 조합이 말이 안 될 수 있다(예: weather+festival_cancelled) —
// PRD 3.5절 상황별 조정표의 실제 짝만 허용 (라운드3 점검 #11, 데모 트리거 버튼 오조작 방지).
const VALID_TRIGGER_CONDITION_PAIRS = {
  weather: ['rain'],
  traffic: ['traffic'],
  festival: ['festival_cancelled'],
};

function isValidTriggerConditionPair(triggerType, condition) {
  return (VALID_TRIGGER_CONDITION_PAIRS[triggerType] || []).includes(condition);
}

function buildMessagePayload(condition, previousName, candidateName) {
  return {
    key: MESSAGE_KEY_BY_CONDITION[condition] || 'alert.generic',
    params: { previous_poi_name: previousName, candidate_poi_name: candidateName },
  };
}

async function fetchOwnedItinerary(itineraryId, userId) {
  const { data: itinerary, error } = await supabaseAdmin
    .from('itineraries')
    .select('*')
    .eq('id', itineraryId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!itinerary) throw apiError(404, 'NOT_FOUND', '일정을 찾을 수 없습니다.');
  return itinerary;
}

function findDayAndStop(itinerary, day, targetPoiId) {
  const dayEntry = itinerary.itinerary_json.days.find((d) => d.day === day);
  if (!dayEntry) throw apiError(404, 'STOP_NOT_FOUND', `day ${day}를 찾을 수 없습니다.`);
  const stopIndex = dayEntry.stops.findIndex((s) => s.poi_id === targetPoiId);
  if (stopIndex === -1) throw apiError(404, 'STOP_NOT_FOUND', `target_poi_id ${targetPoiId}를 day ${day}에서 찾을 수 없습니다.`);
  return { dayEntry, stopIndex, previousStop: dayEntry.stops[stopIndex] };
}

/**
 * @param {object} params
 * @param {string} params.itineraryId
 * @param {string} params.userId - 요청자(로그인 사용자) id. 본인 소유 itinerary인지 확인용 (1주차 점검 #1 — 치명적 보안 결함).
 * @param {'weather'|'traffic'|'festival'} params.triggerType
 * @param {'rain'|'traffic'|'festival_cancelled'} params.condition
 * @param {number} params.day
 * @param {string} params.targetPoiId - 교체 대상 스탑 (previous_poi_id)
 */
async function createProposedAlert({ itineraryId, userId, triggerType, condition, day, targetPoiId }) {
  const itinerary = await fetchOwnedItinerary(itineraryId, userId);
  const { dayEntry, stopIndex, previousStop } = findDayAndStop(itinerary, day, targetPoiId);

  // 중복 방지 (PRD 3.5절/API_CONTRACT.md §3) — 같은 조합으로 이미 proposed면 재-push 없이 그대로 반환.
  // 이때도 응답 본문은 신규 생성과 완전히 동일한 형태여야 한다(1주차 점검 #5 — 강제 트리거 버튼을
  // 두 번 누르거나 cron이 먼저 같은 알림을 만들어둔 경우 프론트가 빈 모달을 띄우던 버그).
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('alerts')
    .select('*')
    .eq('itinerary_id', itineraryId)
    .eq('day', day)
    .eq('previous_poi_id', targetPoiId)
    .eq('status', 'proposed')
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing) {
    const { data: candidatePoi, error: poiErr } = await supabaseAdmin.from('pois').select('*').eq('id', existing.proposed_poi_id).maybeSingle();
    if (poiErr) throw poiErr;
    return {
      alert: existing,
      isDuplicate: true,
      message: buildMessagePayload(existing.condition, previousStop.name, candidatePoi ? candidatePoi.name : existing.proposed_poi_id),
      proposedStop: {
        day,
        previous_poi_id: targetPoiId,
        candidate_poi: candidatePoi
          ? { poi_id: candidatePoi.id, name: candidatePoi.name, category: candidatePoi.category, lat: candidatePoi.lat, lng: candidatePoi.lng }
          : { poi_id: existing.proposed_poi_id },
      },
    };
  }

  const allUsedPoiIds = itinerary.itinerary_json.days.flatMap((d) => d.stops.map((s) => s.poi_id));
  const regionCode = itinerary.region_codes[0];

  const { data: regionPois, error: poisErr } = await supabaseAdmin.from('pois').select('*').eq('region_code', regionCode);
  if (poisErr) throw poisErr;

  let candidatePool = filterByRelationship(regionPois, itinerary.relationship).filter((p) => !allUsedPoiIds.includes(p.id));

  // 축제 날짜 필터 — 그 날짜(day)가 event_start_date~end_date 밖인 festival_event 후보는 제외
  // (PRD 3.5절, 1주차 점검 #11 — 끝난 축제가 대체 후보 1순위로 나오던 버그).
  const targetDate = dateForDayIndex(itinerary.start_date, day - 1);
  candidatePool = candidatePool.filter((p) => {
    if (!(p.tags || []).includes('festival_event')) return true;
    return festivalOverlapsDate(p, targetDate);
  });

  let weights = itinerary.preference_weights;

  if (condition === 'festival_cancelled') {
    // 해당 festival_event POI 1건만 후보에서 제외 (다른 카테고리 영향 없음, PRD 3.5절 조정표)
    candidatePool = candidatePool.filter((p) => p.id !== targetPoiId);
  } else if (condition === 'traffic') {
    // 카테고리 조정 아님 — 교체 대상 바로 이전 스탑(없으면 대상 자신) 좌표 기준 15분 이내로 거리 필터 (PRD 3.5절)
    const referenceStop = stopIndex > 0 ? dayEntry.stops[stopIndex - 1] : previousStop;
    const { withinRange, allFailed } = await filterWithinDuration(referenceStop, candidatePool, TRAFFIC_RADIUS_SECONDS);
    if (allFailed) {
      // 카카오모빌리티 API 전체 실패 — Haversine 거리 근사로 폴백 (1주차 점검 #7)
      candidatePool = candidatePool.filter((p) => haversineKm(referenceStop, p) <= TRAFFIC_FALLBACK_RADIUS_KM);
    } else {
      candidatePool = withinRange;
    }
  } else if (condition === 'rain') {
    // 가중치 0이 아니라 후보 자체를 제외 (PRD 3.5절, 1주차 점검 #12)
    candidatePool = filterOutdoorForRain(candidatePool);
  }

  const [topCandidate] = pickTopCandidates(candidatePool, weights, { limit: 1 });
  if (!topCandidate) {
    throw apiError(404, 'NO_CANDIDATE', '대체 후보를 찾지 못했습니다 (조건에 맞는 POI가 없음).');
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
    message: buildMessagePayload(condition, previousStop.name, topCandidate.name),
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
 * @param {string} params.userId - 요청자 id, alert이 걸린 itinerary의 소유자인지 확인 (1주차 점검 #1)
 */
async function respondToAlert({ alertId, userId, response }) {
  const { data: alert, error: alertErr } = await supabaseAdmin.from('alerts').select('*').eq('id', alertId).maybeSingle();
  if (alertErr) throw alertErr;
  if (!alert) throw apiError(404, 'NOT_FOUND', '알림을 찾을 수 없습니다.');

  // 본인 소유 itinerary인지 먼저 확인 (service-role 클라이언트는 RLS를 우회하므로 이 체크가 없으면
  // itinerary_id/alert_id만 알면 남의 일정을 조회·변경할 수 있었다 — 1주차 점검 #1, 치명적).
  const itinerary = await fetchOwnedItinerary(alert.itinerary_id, userId);

  if (alert.status !== 'proposed') {
    // 3분 타임아웃과 Yes 클릭이 경쟁하는 정상 케이스 — 500이 아니라 409로 다룬다 (1주차 점검 #6).
    throw apiError(409, 'ALERT_EXPIRED', `이미 ${alert.status} 상태인 알림입니다.`);
  }

  if (response === 'no') {
    const { error } = await supabaseAdmin.from('alerts').update({ status: 'dismissed', responded_at: new Date().toISOString() }).eq('id', alertId);
    if (error) throw error;
    return { status: 'dismissed' };
  }

  // .single()이면 존재하지 않는 poi_id일 때 500이 난다 — §0.1 기준 404 NOT_FOUND가 맞다 (라운드2 점검 #6)
  const { data: candidatePoi, error: poiErr } = await supabaseAdmin.from('pois').select('*').eq('id', alert.proposed_poi_id).maybeSingle();
  if (poiErr) throw poiErr;
  if (!candidatePoi) throw apiError(404, 'NOT_FOUND', '대체 후보 POI를 찾을 수 없습니다.');

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

  const { error: updateAlertErr } = await supabaseAdmin
    .from('alerts')
    .update({ status: 'confirmed', responded_at: new Date().toISOString() })
    .eq('id', alertId);
  if (updateAlertErr) throw updateAlertErr;

  // API_CONTRACT.md §3 응답 계약은 {status, updated_stop}만 — alert 전체 row를 실어보내지 않는다 (1주차 점검 #18)
  return { status: 'confirmed', updated_stop: { poi_id: candidatePoi.id, day: alert.day } };
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

module.exports = {
  createProposedAlert,
  respondToAlert,
  dismissExpiredProposals,
  ALLOWED_TRIGGER_TYPES,
  ALLOWED_CONDITIONS,
  isValidTriggerConditionPair,
};
