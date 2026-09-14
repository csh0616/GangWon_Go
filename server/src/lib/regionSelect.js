// PRD 3.5절 2.4단계 "어디든지" — 자유 텍스트 가중치에 가장 잘 맞는 시군을 서버가 고른다 (라운드5 【6】).
const { CATEGORY_KEYS, REGION_CODES, REGION_LAT } = require('./categories');

const TOP_SCORE_THRESHOLD_RATIO = 0.6;

/**
 * @param {Array} allPois - 3개 시군 pois 전체 (region_code, tags 포함)
 * @param {object} weights - 7개 카테고리 가중치
 * @param {number} tripDays - 여행 일수
 * @returns {string[]} 선택된 region_codes (점수 내림차순, 최대 min(tripDays,3)개)
 */
function selectRegionsForAuto(allPois, weights, tripDays) {
  const byRegion = {};
  REGION_CODES.forEach((r) => {
    byRegion[r] = { total: 0, counts: {} };
  });
  allPois.forEach((p) => {
    const bucket = byRegion[p.region_code];
    if (!bucket) return;
    bucket.total += 1;
    (p.tags || []).forEach((t) => {
      bucket.counts[t] = (bucket.counts[t] || 0) + 1;
    });
  });

  // 1. share(r,c) = count(r,c)/total(r) — 절대 건수를 쓰면 POI 많은 시군이 항상 이긴다
  // 2. score(r) = Σ weights[c] × share(r,c)
  const scored = REGION_CODES.map((region) => {
    const bucket = byRegion[region];
    if (bucket.total === 0) return { region, score: 0 };
    const score = CATEGORY_KEYS.reduce((sum, cat) => {
      const share = (bucket.counts[cat] || 0) / bucket.total;
      return sum + (weights[cat] || 0) * share;
    }, 0);
    return { region, score };
  });

  const maxScore = Math.max(...scored.map((s) => s.score));

  // 가중치가 전부 낮아 점수가 전부 0에 가까운 경우(예: free_text는 있으나 LLM 추출이 실패해
  // 폴백 weights=0을 쓴 경우) — 시군을 고를 근거가 없으므로 POI 총량 기준으로 안전하게 폴백한다.
  // 계약상 region_codes:[]+빈 free_text는 이 함수 호출 전에 이미 400으로 막혀 있다.
  if (maxScore <= 0) {
    return [...REGION_CODES]
      .sort((a, b) => byRegion[b].total - byRegion[a].total)
      .slice(0, Math.min(tripDays, 3));
  }

  // 3. 1위 점수의 60% 이상인 시군만, 점수 내림차순 최대 min(여행 일수, 3)개
  const threshold = maxScore * TOP_SCORE_THRESHOLD_RATIO;
  return scored
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(tripDays, 3))
    .map((s) => s.region);
}

/**
 * PRD 3.5절 2.5단계 — 위도 내림차순(북→남) 정렬 후 연속 날짜 블록으로 배분.
 * @returns {Array<{region_code, dayOffset, count}>}
 */
function assignRegionsToDayBlocks(regionCodes, tripDays) {
  const sorted = [...new Set(regionCodes)].sort((a, b) => REGION_LAT[b] - REGION_LAT[a]);
  const base = Math.floor(tripDays / sorted.length);
  const remainder = tripDays % sorted.length;
  const blocks = [];
  let dayOffset = 0;
  sorted.forEach((region, i) => {
    const count = base + (i < remainder ? 1 : 0);
    blocks.push({ region_code: region, dayOffset, count });
    dayOffset += count;
  });
  return blocks;
}

module.exports = { selectRegionsForAuto, assignRegionsToDayBlocks };
