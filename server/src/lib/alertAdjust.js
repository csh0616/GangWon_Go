// PRD 3.5절 — 상황별 후보 조정표.
// rain은 "가중치 0"이 아니라 "후보 제외"다 (1주차 아키텍처 점검에서 수정 — 태그를 여러 개 가진
// POI가 가중치만 0으로 낮춘 남은 점수로 여전히 1위가 될 수 있었음. 특히 자유텍스트 없이 만든
// 코스는 가중치가 전부 0이라 전부 동점이 되어 DB 순서대로 아무거나 뽑히는 문제가 있었다).
const RAIN_EXCLUDED_TAGS = ['nature_hiking', 'leisure_sports', 'festival_event'];

function filterOutdoorForRain(pois) {
  return pois.filter((p) => !(p.tags || []).some((tag) => RAIN_EXCLUDED_TAGS.includes(tag)));
}

module.exports = { filterOutdoorForRain, RAIN_EXCLUDED_TAGS };
