import type { CategoryKey, PreferenceWeights } from "./types";

/**
 * "반영한 취향" 칩 규칙 (확정 — PRD 6장 / 프론트 세션 프롬프트):
 * preference_weights 7개 중 0.5 이상인 것만, 최대 3개, 가중치 내림차순.
 * 해당하는 게 없으면 빈 배열을 반환하고, 호출부는 칩 영역 자체를 렌더링하지 않아야 한다
 * (design/artboards/ResultNoPref.dc.html 참고).
 */
export function topPreferenceChips(
  weights: PreferenceWeights | null | undefined
): CategoryKey[] {
  if (!weights) return [];
  return (Object.entries(weights) as [CategoryKey, number][])
    .filter(([, value]) => value >= 0.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);
}
