// PRD 3.5절 — DB 조회 + 알고리즘 (LLM 미사용) 단계. API_CONTRACT.md §1 3번 처리 단계에 대응.
const { ACTIVITY_STOP_RANGE } = require('./categories');
const { haversineKm, twoOptOptimize, kMeansCluster } = require('./geo');

// 앵커 주변 채우기: 거리가 스코어 순위를 얼마나 흔들 수 있는지 (0=거리 무시, 1=거리만 봄).
// 스코어를 1차 기준으로 유지하면서 근접도로 동점/근소차를 가르는 정도의 값 (1주차 점검 #13).
const ANCHOR_DISTANCE_PENALTY_WEIGHT = 0.3;

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

  // festival_event 후보는 "일자 검사만 통과하면 배치 가능" — 가중치(__score) 조건을 걸면 안 된다
  // (라운드2 점검 #1). free_text 없이 생성하면 가중치가 전부 0이라(API_CONTRACT §1) 예전 코드의
  // `__score > 0` 게이트에 항상 걸려서 개최일이 맞는 축제도 코스에 못 들어갔다.
  function isDateEligible(poi, date) {
    if (!(poi.tags || []).includes('festival_event')) return true;
    return festivalOverlapsDate(poi, date);
  }

  const dayPlans = [];
  for (let i = 0; i < numDays; i += 1) {
    const date = dateForDayIndex(startDate, i);
    const anchor = scored
      .filter((p) => !usedIds.has(p.id))
      .filter((p) => (p.tags || []).includes('festival_event'))
      .filter((p) => festivalOverlapsDate(p, date))
      .sort((a, b) => b.__score - a.__score)[0] || null;

    if (anchor) usedIds.add(anchor.id);
    dayPlans.push({ date, anchor, slots: maxPerDay - (anchor ? 1 : 0), picked: [] });
  }

  // 앵커에 못 든 festival_event도 일반 스탑 풀에서 완전히 제외하지 않는다 (라운드2 점검 #1) —
  // 그 날짜와 맞기만 하면 일반 경로로도 배치될 수 있어야 한다. 대신 각 배치 단계에서
  // isDateEligible()로 "그 날짜가 아닌 축제"만 걸러낸다.
  let freePool = scored.filter((p) => !usedIds.has(p.id));

  // 앵커가 있는 날: "그 주변으로 클러스터링"이되 가중치 스코어를 1차 기준으로, 거리는 함께 고려한다
  // (1주차 아키텍처 점검 #13 — 거리만 보면 사용자 취향이 그 날 통째로 무시되고, 앵커 근처 POI가
  // 먼저 소진돼 다른 날 후보 품질까지 떨어졌다).
  dayPlans.forEach((dp) => {
    if (!dp.anchor) return;
    const eligible = freePool.filter((p) => isDateEligible(p, dp.date));
    const withDistance = eligible.map((p) => ({ ...p, __distanceToAnchor: haversineKm(dp.anchor, p) }));
    const maxDist = Math.max(1e-6, ...withDistance.map((p) => p.__distanceToAnchor));
    const ranked = withDistance
      .map((p) => ({ ...p, __combined: p.__score - ANCHOR_DISTANCE_PENALTY_WEIGHT * (p.__distanceToAnchor / maxDist) }))
      .sort((a, b) => b.__combined - a.__combined)
      .slice(0, dp.slots);
    dp.picked = ranked;
    const pickedIds = new Set(ranked.map((p) => p.id));
    freePool = freePool.filter((p) => !pickedIds.has(p.id));
  });

  // 앵커 없는 날들: 점수 상위 후보를 지리적으로 k-means 클러스터링 후 배분.
  // k-means는 날짜를 모르므로 클러스터링 자체에는 festival_event를 넣지 않고(지리적 편향 방지),
  // 클러스터→날짜 배정 이후 단계에서 isDateEligible()로 걸러 leftover로 넘긴다.
  const nonAnchorDays = dayPlans.filter((dp) => !dp.anchor);
  const totalNonAnchorSlots = nonAnchorDays.reduce((sum, dp) => sum + dp.slots, 0);
  const topPool = freePool
    .filter((p) => !(p.tags || []).includes('festival_event'))
    .sort((a, b) => b.__score - a.__score)
    .slice(0, totalNonAnchorSlots);
  const festivalLeftover = freePool.filter((p) => (p.tags || []).includes('festival_event'));
  const clusters = kMeansCluster(topPool, Math.max(nonAnchorDays.length, 1));

  let leftover = festivalLeftover.slice();
  nonAnchorDays.forEach((dp, idx) => {
    const cluster = (clusters[idx] || []).slice().sort((a, b) => b.__score - a.__score);
    dp.picked = cluster.slice(0, dp.slots);
    leftover = leftover.concat(cluster.slice(dp.slots));
  });
  nonAnchorDays.forEach((dp) => {
    // eslint-disable-next-line no-constant-condition
    while (dp.picked.length < dp.slots) {
      leftover.sort((a, b) => b.__score - a.__score);
      const idx = leftover.findIndex((p) => isDateEligible(p, dp.date));
      if (idx === -1) break; // 남은 leftover 중 이 날짜에 맞는 게 없음
      dp.picked.push(leftover[idx]);
      leftover.splice(idx, 1);
    }
  });

  // days는 여행 기간 전 일자를 빠짐없이·순서대로 반환한다 — day는 1부터 연속, date는 KST
  // YYYY-MM-DD (API_CONTRACT.md §1 "days 배열 불변식", 라운드3 점검 #4). 라운드2에서 스탑 0개인
  // day를 배열에서 아예 빼는 방식으로 고쳤었는데, 그러면 day 번호에 구멍이 생겨 프론트가 방어
  // 코드를 짜야 하고(3일 여행에 [{day:3}]만 오는 경우가 실제 확인됨) 날짜를 클라이언트가
  // 재계산하면서 KST 버그가 화면단에서 되살아난다. 추천할 장소가 없는 날은 stops:[]로 그대로
  // 반환 — "200으로 준 코스가 저장 시 400" 불일치는 validators.js 쪽 완화로 별도 해결(§ 관련 커밋).
  return dayPlans.map((dp, idx) => {
    const stops = dp.anchor ? [dp.anchor, ...dp.picked] : dp.picked;
    const ordered = twoOptOptimize(stops, { pinFirst: !!dp.anchor });
    return { day: idx + 1, date: dp.date.toISOString().slice(0, 10), stops: ordered.map((p, i) => toStopShape(p, i + 1)) };
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
  dateForDayIndex,
  festivalOverlapsDate,
  festivalOverlapsRange,
  buildItineraryDays,
  pickTopCandidates,
  toStopShape,
};
