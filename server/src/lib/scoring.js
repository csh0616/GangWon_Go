// PRD 3.5절 — DB 조회 + 알고리즘 (LLM 미사용) 단계. API_CONTRACT.md §1 3번 처리 단계에 대응.
const { ACTIVITY_STOP_RANGE } = require('./categories');
const { haversineKm, twoOptOptimize, kMeansCluster } = require('./geo');

function scorePoi(poi, weights) {
  const tags = poi.tags || [];
  return tags.reduce((sum, tag) => sum + (weights[tag] || 0), 0);
}

// PRD 3.5절 — relationship 필터. 마스터 태그(tags[])는 7개 키 고정이라 "성인 전용" 같은 값을
// tags에 넣을 수 없으므로, pois.adult_only(boolean) 별도 필드로 처리한다 (HANDOFF_LOG 참고).
function filterByRelationship(pois, relationship) {
  if (relationship === 'family_with_kids') {
    return pois.filter((p) => !p.adult_only);
  }
  return pois;
}

function daysCount(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

function dateForDayIndex(startDate, index) {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + index);
  return d;
}

function festivalOverlapsDate(poi, date) {
  if (!poi.event_start_date || !poi.event_end_date) return false;
  const es = new Date(`${poi.event_start_date}T00:00:00Z`);
  const ee = new Date(`${poi.event_end_date}T00:00:00Z`);
  return date >= es && date <= ee;
}

function festivalOverlapsRange(poi, startDate, endDate) {
  if (!poi.event_start_date || !poi.event_end_date) return false;
  const es = new Date(`${poi.event_start_date}T00:00:00Z`);
  const ee = new Date(`${poi.event_end_date}T00:00:00Z`);
  const rs = new Date(`${startDate}T00:00:00Z`);
  const re = new Date(`${endDate}T00:00:00Z`);
  return es <= re && ee >= rs;
}

function toStopShape(poi, order) {
  return {
    poi_id: poi.id,
    name: poi.name,
    category: poi.category,
    lat: poi.lat,
    lng: poi.lng,
    order,
  };
}

/**
 * PRD 3.5절 3번 단계 전체: festival 날짜 필터 → 스코어링 → activity_level별 하루 스탑 수 결정
 * → 일자별 클러스터링(앵커 주변/k-means) → 클러스터 내부 2-opt.
 *
 * @param {Array} pois - region_code/relationship 필터까지 이미 적용된 pois 배열
 * @param {object} weights - 7개 카테고리 가중치
 * @param {string} activityLevel - low|medium|high
 * @param {string} startDate, endDate - YYYY-MM-DD
 * @param {string[]} [excludePoiIds] - 이미 코스에 쓰인 POI 제외 (부분 재구성 재사용 대비)
 */
function buildItineraryDays({ pois, weights, activityLevel, startDate, endDate, excludePoiIds = [] }) {
  const excludeSet = new Set(excludePoiIds);
  const numDays = daysCount(startDate, endDate);
  const [, maxPerDay] = ACTIVITY_STOP_RANGE[activityLevel] || ACTIVITY_STOP_RANGE.medium;

  let pool = pois.filter((p) => !excludeSet.has(p.id));

  // festival_event: 여행 날짜와 겹치지 않으면 가중치와 무관하게 후보 풀에서 완전히 제외 (PRD 3.5절)
  pool = pool.filter((p) => {
    const tags = p.tags || [];
    if (!tags.includes('festival_event')) return true;
    return festivalOverlapsRange(p, startDate, endDate);
  });

  const scored = pool.map((p) => ({ ...p, __score: scorePoi(p, weights) }));
  const usedIds = new Set();

  const dayPlans = [];
  for (let i = 0; i < numDays; i += 1) {
    const date = dateForDayIndex(startDate, i);
    const anchor = scored
      .filter((p) => !usedIds.has(p.id))
      .filter((p) => (p.tags || []).includes('festival_event'))
      .filter((p) => festivalOverlapsDate(p, date))
      .filter((p) => p.__score > 0)
      .sort((a, b) => b.__score - a.__score)[0] || null;

    if (anchor) usedIds.add(anchor.id);
    dayPlans.push({ date, anchor, slots: maxPerDay - (anchor ? 1 : 0), picked: [] });
  }

  let freePool = scored.filter((p) => !usedIds.has(p.id));

  // 앵커가 있는 날: "그 주변으로 클러스터링" = 앵커와 가까운 순으로 채움 (PRD 3.5절)
  dayPlans.forEach((dp) => {
    if (!dp.anchor) return;
    const nearest = freePool
      .slice()
      .sort((a, b) => haversineKm(dp.anchor, a) - haversineKm(dp.anchor, b))
      .slice(0, dp.slots);
    dp.picked = nearest;
    const pickedIds = new Set(nearest.map((p) => p.id));
    freePool = freePool.filter((p) => !pickedIds.has(p.id));
  });

  // 앵커 없는 날들: 점수 상위 후보를 지리적으로 k-means 클러스터링 후 배분
  const nonAnchorDays = dayPlans.filter((dp) => !dp.anchor);
  const totalNonAnchorSlots = nonAnchorDays.reduce((sum, dp) => sum + dp.slots, 0);
  const topPool = freePool.slice().sort((a, b) => b.__score - a.__score).slice(0, totalNonAnchorSlots);
  const clusters = kMeansCluster(topPool, Math.max(nonAnchorDays.length, 1));

  let leftover = [];
  nonAnchorDays.forEach((dp, idx) => {
    const cluster = (clusters[idx] || []).slice().sort((a, b) => b.__score - a.__score);
    dp.picked = cluster.slice(0, dp.slots);
    leftover = leftover.concat(cluster.slice(dp.slots));
  });
  nonAnchorDays.forEach((dp) => {
    while (dp.picked.length < dp.slots && leftover.length > 0) {
      leftover.sort((a, b) => b.__score - a.__score);
      dp.picked.push(leftover.shift());
    }
  });

  return dayPlans.map((dp, idx) => {
    const stops = dp.anchor ? [dp.anchor, ...dp.picked] : dp.picked;
    const ordered = twoOptOptimize(stops, { pinFirst: !!dp.anchor });
    return { day: idx + 1, stops: ordered.map((p, i) => toStopShape(p, i + 1)) };
  });
}

/**
 * 부분 재구성 (PRD 3.5절) — 후보 최대 3개 (수동) 또는 1개(자동 매니징) 반환용.
 */
function pickTopCandidates(pois, weights, { excludePoiIds = [], limit = 3 } = {}) {
  const excludeSet = new Set(excludePoiIds);
  return pois
    .filter((p) => !excludeSet.has(p.id))
    .map((p) => ({ ...p, __score: scorePoi(p, weights) }))
    .sort((a, b) => b.__score - a.__score)
    .slice(0, limit);
}

module.exports = {
  scorePoi,
  filterByRelationship,
  daysCount,
  festivalOverlapsDate,
  festivalOverlapsRange,
  buildItineraryDays,
  pickTopCandidates,
  toStopShape,
};
