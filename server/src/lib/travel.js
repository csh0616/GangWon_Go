// PRD 3장/5장, API_CONTRACT.md §1 — 라운드5 【7】. 순서는 이미 Haversine+2-opt로 정해져 있고,
// 여기서는 그 순서를 따라 인접 스탑 1:1로만 카카오모빌리티를 호출해 실제 이동시간/모드를 채운다
// (다중경유지 아님, PRD 3장). 실패 시 필드 전체를 null로 둔다 — 추정값을 지어내지 않는다.
const { haversineKm } = require('./geo');
const { getDrivingDurationSeconds } = require('./directions');

const WALK_THRESHOLD_KM = 1;

function modeFor(distanceKm) {
  return distanceKm < WALK_THRESHOLD_KM ? 'walk' : 'car';
}

async function computeTravel(from, to) {
  try {
    const mode = modeFor(haversineKm(from, to));
    const durationSec = await getDrivingDurationSeconds(from, to);
    return { mode, minutes: Math.max(1, Math.round(durationSec / 60)) };
  } catch (err) {
    // P1(라운드8) — 이 실패의 다수는 출발지=도착지(동일 좌표 POI, scoring.js dedupeByCoordinate로
    // 대부분 사라짐)였다. dedupe 이후에도 남는 실패는 좌표 문제가 아닌 다른 원인이므로, 다음
    // 라운드에서 바로 추적할 수 있게 출발/도착 좌표를 로그에 함께 남긴다. 폴백 자체(필드 전체
    // null, 추정값을 지어내지 않음)는 계약대로라 그대로 둔다.
    // eslint-disable-next-line no-console
    console.warn(
      '[travel] 이동 정보 계산 실패, null로 둠:',
      err.message,
      `| from=(${from.lat},${from.lng}) to=(${to.lat},${to.lng})`
    );
    return null;
  }
}

/**
 * 하루(day) 안의 stops[]에 travel_from_prev를 채운다. 첫 스탑은 항상 null.
 * 각 구간(전 스탑→현재 스탑)은 이미 정해진 순서의 좌표 쌍이라 서로 의존성이 없으므로 병렬 호출한다 —
 * 순차 await로 짰더니 스탑 수만큼 카카오 API 왕복 지연이 누적돼 3초 예산을 크게 넘겼다(실측 15초+).
 */
async function fillTravelFromPrev(stops) {
  const travels = await Promise.all(stops.map((stop, i) => (i === 0 ? null : computeTravel(stops[i - 1], stop))));
  return stops.map((stop, i) => ({ ...stop, travel_from_prev: travels[i] }));
}

/**
 * days 배열 전체에 travel_from_prev_day를 채운다. day1은 항상 null. 전날 stops가 비어 있으면
 * (stops:[]) 그보다 이전의, 스탑이 있는 마지막 날을 기준으로 계산한다(API_CONTRACT.md §1 불변식).
 * fillTravelFromPrev와 같은 이유로 날짜 쌍마다 병렬 호출한다.
 */
async function fillTravelBetweenDays(days) {
  const result = days.map((d) => ({ ...d }));
  const pairs = result.map((d, i) => {
    if (i === 0) return null;
    let j = i - 1;
    while (j >= 0 && result[j].stops.length === 0) j -= 1;
    const currentFirstStop = d.stops[0];
    if (j < 0 || !currentFirstStop) return null;
    return { fromIdx: j, prevLastStop: result[j].stops[result[j].stops.length - 1], currentFirstStop };
  });

  const travels = await Promise.all(pairs.map((p) => (p ? computeTravel(p.prevLastStop, p.currentFirstStop) : null)));

  return result.map((d, i) => {
    const p = pairs[i];
    const travel = travels[i];
    if (!p || !travel) return { ...d, travel_from_prev_day: null };
    return { ...d, travel_from_prev_day: { from_region_code: result[p.fromIdx].region_code, to_region_code: d.region_code, ...travel } };
  });
}

module.exports = { fillTravelFromPrev, fillTravelBetweenDays };
