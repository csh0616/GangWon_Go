// API_CONTRACT.md §0.1 (1주차 아키텍처 점검에서 확정) — INVALID_STRUCTURED_INPUT 판정 기준.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TRIP_DAYS = 10;

function isValidDateString(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  // 2026-13-45 같은 값은 Date가 다음 달/일로 굴려버리므로, 되돌린 문자열이 원본과 같은지로 검증
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * @returns {{valid:true, days:number} | {valid:false, reason:string}}
 */
function validateTripDates(startDate, endDate) {
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    return { valid: false, reason: 'start_date/end_date는 YYYY-MM-DD 형식이어야 합니다.' };
  }
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (end < start) {
    return { valid: false, reason: 'end_date는 start_date보다 앞설 수 없습니다.' };
  }
  const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  if (days > MAX_TRIP_DAYS) {
    return { valid: false, reason: `여행 기간은 최대 ${MAX_TRIP_DAYS}일입니다.` };
  }
  return { valid: true, days };
}

function isValidCompanions(companions) {
  return Number.isInteger(companions) && companions >= 1;
}

// PRD 3.5절 itinerary_json.days 구조 검증 — 저장 시점에 막아야 감시 에이전트가 안전하다 (1주차 점검 #8).
function isValidItineraryJson(itineraryJson) {
  if (!itineraryJson || !Array.isArray(itineraryJson.days) || itineraryJson.days.length === 0) return false;
  return itineraryJson.days.every(
    (d) =>
      Number.isInteger(d.day) &&
      Array.isArray(d.stops) &&
      d.stops.length > 0 &&
      d.stops.every((s) => typeof s.poi_id === 'string' && s.poi_id.length > 0)
  );
}

module.exports = { isValidDateString, validateTripDates, isValidCompanions, isValidItineraryJson, MAX_TRIP_DAYS };
