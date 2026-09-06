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
 * origin 기준 이동시간이 maxSeconds 이하인 후보만 남긴다. 후보 호출은 병렬로 처리하고(순차 호출이던
 * 것을 1주차 점검에서 병렬화 — 후보 수만큼 지연시간이 누적돼 3초 기준을 넘길 수 있었음), 개별 실패는
 * 그 후보만 제외한다. **전부 실패**하면(카카오 키 미설정/장애) `allFailed: true`를 반환해 호출부가
 * Haversine 거리 근사로 폴백할 수 있게 한다 — 후보가 진짜 0건인 것과 API 전체 장애를 구분하기 위함
 * (PRD 6장 폴백 원칙: 실패한 조각만 조용히 대체, 핵심 경험은 막지 않음).
 * @returns {Promise<{withinRange: Array, allFailed: boolean}>}
 */
async function filterWithinDuration(origin, candidates, maxSeconds) {
  if (candidates.length === 0) return { withinRange: [], allFailed: false };

  const results = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const duration = await getDrivingDurationSeconds(origin, candidate);
        return { candidate, duration, ok: true };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[directions] 후보 ${candidate.id} 이동시간 조회 실패, 후보에서 제외:`, err.message);
        return { candidate, ok: false };
      }
    })
  );

  const succeeded = results.filter((r) => r.ok);
  const withinRange = succeeded.filter((r) => r.duration <= maxSeconds).map((r) => r.candidate);
  const allFailed = succeeded.length === 0;
  return { withinRange, allFailed };
}

module.exports = { getDrivingDurationSeconds, filterWithinDuration };
