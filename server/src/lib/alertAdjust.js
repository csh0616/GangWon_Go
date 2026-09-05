// PRD 3.5절 — 상황별 카테고리 조정표 (전 항목 확정)
const { emptyWeights } = require('./categories');

const RAIN_SUPPRESSED_TAGS = ['nature_hiking', 'leisure_sports', 'festival_event'];

/**
 * condition에 따라 preference_weights를 조정한다. traffic은 카테고리 조정이 아니라
 * 거리 기준 후보 재선정이므로 여기서는 원본 가중치를 그대로 반환한다 (호출부에서 거리 필터 적용).
 */
function adjustWeightsForCondition(weights, condition) {
  const adjusted = { ...emptyWeights(), ...weights };
  if (condition === 'rain') {
    RAIN_SUPPRESSED_TAGS.forEach((tag) => {
      adjusted[tag] = 0;
    });
  }
  // condition === 'traffic' → 조정 없음 (거리 필터는 scoring.js의 후보 선정 단계에서 처리)
  // condition === 'festival_cancelled' → 조정 없음 (해당 festival_event POI 1건만 후보에서 제외, 호출부 처리)
  return adjusted;
}

module.exports = { adjustWeightsForCondition, RAIN_SUPPRESSED_TAGS };
