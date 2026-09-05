// PRD 3장 — 카카오모빌리티 Directions API (자동차 길찾기). 인접 스탑 1:1 호출만 사용 (다중경유지 아님).
// traffic 조건의 "이동시간 15분 이내 후보 재선정"(PRD 3.5절)에도 재사용.
const env = require('../config/env');

const KAKAO_MOBILITY_URL = 'https://apis-navi.kakaomobility.com/v1/directions';

async function getDrivingDurationSeconds(origin, destination) {
  if (!env.kakaoMobilityApiKey) {
    throw new Error('KAKAO_MOBILITY_API_KEY가 설정되지 않았습니다 (.env 확인).');
  }
  const params = new URLSearchParams({
    origin: `${origin.lng},${origin.lat}`,
    destination: `${destination.lng},${destination.lat}`,
  });
  const res = await fetch(`${KAKAO_MOBILITY_URL}?${params.toString()}`, {
    headers: { Authorization: `KakaoAK ${env.kakaoMobilityApiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Kakao Mobility Directions API 실패: HTTP ${res.status}`);
  }
  const data = await res.json();
  const route = data.routes && data.routes[0];
  if (!route || route.result_code !== 0) {
    throw new Error('Kakao Mobility Directions API 응답에 유효한 경로가 없습니다.');
  }
  return route.summary.duration; // seconds
}

/**
 * origin 기준 이동시간이 maxSeconds 이하인 후보만 남긴다. 개별 호출 실패는 그 후보만 제외하고 계속 진행
 * (전체 요청을 막지 않음, PRD 6장 폴백 원칙과 동일 정신).
 */
async function filterWithinDuration(origin, candidates, maxSeconds) {
  const results = [];
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const duration = await getDrivingDurationSeconds(origin, candidate);
      if (duration <= maxSeconds) results.push(candidate);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[directions] 후보 ${candidate.id} 이동시간 조회 실패, 후보에서 제외:`, err.message);
    }
  }
  return results;
}

module.exports = { getDrivingDurationSeconds, filterWithinDuration };
