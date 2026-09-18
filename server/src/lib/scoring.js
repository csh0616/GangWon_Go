// PRD 3.5절 — DB 조회 + 알고리즘 (LLM 미사용) 단계. API_CONTRACT.md §1 3번 처리 단계에 대응.
const { ACTIVITY_STOP_RANGE, isValidCategoryKey } = require('./categories');
const { haversineKm, twoOptOptimize, kMeansCluster } = require('./geo');

// P0-1 — pois.category는 TourAPI 원본 코드("A01010900")이고, 7개 마스터 키는 pois.tags[0]에
// 이미 매핑돼 들어가 있다(category_mapping.js). 예전에는 toStopShape/toCandidateShape가
// poi.category를 그대로 내보내서 프론트 메시지 카탈로그에 없는 값이 나가 next-intl이 예외를
// 던지고 렌더 트리가 무너졌다. 스탑을 만드는 단 한 곳(이 함수)에서만 tags[0]로 바꾸고, 나머지
// 모든 경로가 toStopShape/toCandidateShape를 거치게 해서 같은 사고가 다른 화면에서 재발하지
// 않게 한다. tags가 비어 있거나 7개 키가 아니면(동기화 버그 등 비정상 상황) null — 빈 문자열이나
// 원본 코드를 그대로 내보내지 않는다.
function resolveMasterCategory(poi) {
  const key = Array.isArray(poi.tags) ? poi.tags[0] : null;
  return isValidCategoryKey(key) ? key : null;
}

// P0-1 — 이 수정 이전에 생성·저장된 itinerary_json은 이미 TourAPI 원본 코드가 category에 박혀
// 있을 수 있다. 재동기화로는 고칠 수 없는 과거 데이터라, 저장된 코스를 다시 내보내는 지점
// (GET /:id, PATCH 응답)에서 한 번 더 검증해 마스터 키가 아니면 null로 떨어뜨린다.
function sanitizeStoredDays(days) {
  if (!Array.isArray(days)) return days;
  return days.map((d) => ({
    ...d,
    stops: Array.isArray(d.stops)
      ? d.stops.map((s) => ({ ...s, category: isValidCategoryKey(s.category) ? s.category : null }))
      : d.stops,
  }));
}

// 앵커 주변 채우기: 거리가 스코어 순위를 얼마나 흔들 수 있는지 (0=거리 무시, 1=거리만 봄).
// 스코어를 1차 기준으로 유지하면서 근접도로 동점/근소차를 가르는 정도의 값 (1주차 점검 #13).
const ANCHOR_DISTANCE_PENALTY_WEIGHT = 0.3;

// P0(라운드8) — free_text가 비면 가중치가 전부 0이라 scorePoi가 전 POI에 0점을 주고, 이후
// .sort((a,b) => b.__score - a.__score)는 동점일 때 입력 순서(=DB 조회 순서=TourAPI가 준
// 가나다순)를 그대로 보존한다. 배포본 실측에서 "청춘카페 → 청춘보리밥 → 청산회관 → ..." 가나다순
// 식당 퍼레이드로 나타났다(API_CONTRACT.md §1 "가중치가 전부 0일 때" 상자). poi_id를 해시해
// 이름·삽입 순서와 무관한 결정적 값으로 동점을 가른다 — 난수는 쓰지 않는다(새로고침마다 코스가
// 바뀌면 신뢰를 잃는다는 계약 원칙 그대로).
function stableTieBreakKey(poiId) {
  let hash = 0;
  const id = String(poiId);
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0; // 32비트 오버플로는 그대로 감싸돈다 — 결정적이면 충분
  }
  return hash;
}

// 점수 내림차순, 동점이면 stableTieBreakKey 내림차순. field는 '__score' 또는 '__combined'
// (앵커 주변 거리 가중 점수, 아래 buildItineraryDays 참고) 둘 다에 재사용한다.
function compareByField(field) {
  return (a, b) => b[field] - a[field] || stableTieBreakKey(b.id) - stableTieBreakKey(a.id);
}

// P0(라운드8) — TourAPI가 같은 위치에 여러 상호를 등록하는 경우가 있다(실측: 청춘카페&떡방 /
// 청춘보리밥 진부점이 소수점 10자리까지 동일 좌표). 지도 마커가 겹치고 카카오모빌리티가
// 출발지=도착지 경로를 계산 못 해 travel_from_prev가 null이 된다(§1 상자 3번, 라운드8 P1과
// 동일 원인). 후보 단계에서 좌표당 하나만 남긴다 — 가중치와 무관하게 항상 적용.
// 남길 하나를 고르는 기준도 이름 순서와 무관한 stableTieBreakKey로 결정한다(그래야 이 dedupe
// 자체가 가나다순 편향을 다시 끌어들이지 않는다).
function dedupeByCoordinate(pois) {
  const byCoord = new Map();
  pois.forEach((p) => {
    const key = `${p.lat},${p.lng}`;
    const existing = byCoord.get(key);
    if (!existing || stableTieBreakKey(p.id) > stableTieBreakKey(existing.id)) {
      byCoord.set(key, p);
    }
  });
  return [...byCoord.values()];
}

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

// 다중 시군 날짜 배정(PRD 3.5절 2.5단계)에서 각 시군 블록의 시작/종료일을 계산할 때 쓴다.
function addDaysToDateString(startDate, index) {
  return dateForDayIndex(startDate, index).toISOString().slice(0, 10);
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

// festival_event 후보는 "일자 검사만 통과하면 배치 가능" — 가중치(__score) 조건을 걸면 안 된다
// (라운드2 점검 #1). free_text 없이 생성하면 가중치가 전부 0이라(API_CONTRACT §1) 예전 코드의
// `__score > 0` 게이트에 항상 걸려서 개최일이 맞는 축제도 코스에 못 들어갔다. buildItineraryDays와
// enforceCategoryDiversity(아래, 라운드8) 둘 다 쓰므로 모듈 스코프로 뺐다.
function isDateEligible(poi, date) {
  if (!(poi.tags || []).includes('festival_event')) return true;
  return festivalOverlapsDate(poi, date);
}

function masterCategoryOf(poi) {
  return (poi.tags || [])[0] || null;
}

/**
 * P0(라운드8, 리포트21로 라운드9에서 수정) — 하루 스탑의 과반이 같은 카테고리가 되지 않게
 * 후처리한다. 가중치가 이미 다양성을 만들어주지만, 가중치가 전부 0이거나 한쪽으로 쏠리면
 * 클러스터링 결과가 한 카테고리로 몰릴 수 있다(§1 "가중치가 전부 0일 때" 상자 2번). 기존
 * 스코어링/클러스터링 로직은 건드리지 않고, 각 날짜의 최종 picked(+anchor)만 놓고 과반
 * 카테고리의 최저점 항목을 교체한다.
 *
 * 라운드8 구현은 한 번에 스냅샷을 떠서 교체 후보 카테고리 개수를 다시 보지 않았다 — [음식,음식,
 * 문화] 에서 음식 하나를 '가장 점수 높은 다른 카테고리'로 바꿨더니 문화가 [음식,문화,문화]로
 * 새 과반이 됐다(리포트21). 이번엔 스왑 하나마다 그 날의 카테고리 개수를 다시 계산하고,
 * 교체 후보는 "그 카테고리로 바꿔도 그 카테고리 자체가 허용량(maxAllowed)을 넘지 않는" 경우만
 * 고른다. 한 날짜에 동시에 과반인 카테고리는 최대 하나뿐이라(합이 n을 넘을 수 없음) 매 반복
 * 하나씩만 줄여나가면 유한 번(원래 초과분만큼) 안에 끝난다. 그래도 만족할 카테고리가 없으면
 * 그 자리에서 제약을 완화하고 로그만 남긴다 — 코스 생성이 이것 때문에 실패해서는 안 된다.
 * @param {Array} dayPlans - {date, anchor, picked, slots} 배열, buildItineraryDays 내부에서 in-place 수정
 * @param {Array} scored - __score가 계산된 전체 후보 풀(이미 festival 날짜 필터 적용됨)
 */
function enforceCategoryDiversity(dayPlans, scored) {
  const usedIds = new Set();
  dayPlans.forEach((dp) => {
    if (dp.anchor) usedIds.add(dp.anchor.id);
    dp.picked.forEach((p) => usedIds.add(p.id));
  });

  dayPlans.forEach((dp) => {
    const currentStops = () => (dp.anchor ? [dp.anchor, ...dp.picked] : dp.picked);
    const n = currentStops().length;
    if (n === 0) return;
    const maxAllowed = Math.floor(n / 2); // 이 값을 넘으면(=count*2 > n) 과반

    // 한 날짜에 두 카테고리가 동시에 과반일 수는 없다(카운트 합이 n을 넘어야 하므로) — 매 반복
    // 최신 카운트를 다시 계산해 남은 과반 하나를 찾고, 스왑 하나로 그 카테고리를 정확히 1 줄인다.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const counts = new Map();
      currentStops().forEach((p) => {
        const cat = masterCategoryOf(p);
        counts.set(cat, (counts.get(cat) || 0) + 1);
      });

      const violating = [...counts.entries()].find(([cat, count]) => cat !== null && count > maxAllowed);
      if (!violating) break;
      const [cat] = violating;

      const group = currentStops().filter((p) => masterCategoryOf(p) === cat);
      const victim = group.slice().sort(compareByField('__score')).reverse()[0]; // 최저점

      // 교체 후보는 (a) 과반 카테고리가 아니고 (b) 바꿔 넣어도 그 카테고리 자체가 허용량을
      // 넘지 않아야 한다 — 넘으면 반대쪽으로 과반을 옮기는 것일 뿐이다(리포트21 원인).
      const replacement = scored
        .filter((p) => !usedIds.has(p.id))
        .filter((p) => {
          const rc = masterCategoryOf(p);
          if (rc === cat) return false;
          return (counts.get(rc) || 0) + 1 <= maxAllowed;
        })
        .filter((p) => isDateEligible(p, dp.date))
        .sort(compareByField('__score'))[0];

      if (!replacement) {
        // eslint-disable-next-line no-console
        console.warn(
          `[scoring] ${dp.date.toISOString().slice(0, 10)} 카테고리 다양성 제약 완화 — ` +
            `"${cat}"를 대체할, 허용량이 남은 다른 카테고리 후보가 없어 그대로 둠`
        );
        break; // 이 날짜는 더 못 고친다 — 완화하고 다음 날짜로
      }

      if (dp.anchor && dp.anchor.id === victim.id) {
        dp.anchor = replacement;
      } else {
        const idx = dp.picked.findIndex((p) => p.id === victim.id);
        if (idx !== -1) dp.picked[idx] = replacement;
      }
      usedIds.delete(victim.id);
      usedIds.add(replacement.id);
      // 루프 처음으로 돌아가 카운트를 다시 계산 — 이 스왑이 새 과반을 만들지 않았는지도 여기서 확인됨
    }
  });
}

function toStopShape(poi, order) {
  return {
    poi_id: poi.id,
    // 라운드5 【3】 — name이 문자열 → {ko,en,zh} 객체로 변경. ko는 TourAPI 원본이라 항상 있고,
    // en/zh는 배치 동기화 시 생성 실패하면 null일 수 있다(pois.name_en/name_zh 그대로 옮김).
    name: { ko: poi.name, en: poi.name_en ?? null, zh: poi.name_zh ?? null },
    category: resolveMasterCategory(poi),
    is_indoor: poi.is_indoor ?? false,
    lat: poi.lat,
    lng: poi.lng,
    order,
    // blurb/travel_from_prev는 LLM/카카오모빌리티 호출 결과라 이 함수(순수 스코어링) 밖에서
    // 채운다 — 호출부(routes/itineraries.js)가 이 placeholder를 덮어쓴다.
    blurb: null,
    travel_from_prev: null,
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
 * @param {number} [dayNumberOffset] - 다중 시군 날짜 배정(PRD 3.5절 2.5단계)에서 이 블록이 전체
 *   여행의 몇 일차부터 시작하는지. 이 함수는 여전히 startDate~endDate 범위만 계산하고, 반환하는
 *   day 번호에 이 오프셋을 더할 뿐이다 — 스코어링/클러스터링/2-opt 로직은 전혀 바뀌지 않는다.
 * @param {string} [regionCode] - 이 블록에 배정된 단일 시군 (다중 시군 요청일 때 day.region_code로 표시)
 */
function buildItineraryDays({ pois, weights, activityLevel, startDate, endDate, excludePoiIds = [], dayNumberOffset = 0, regionCode = null }) {
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

  // P0(라운드9, 리포트 20) — dedupe는 "이용 가능한" 후보끼리 겨뤄야 한다. 순서가 반대였을 때
  // 같은 좌표에 [종료된 축제]와 [정상 관광지]가 있으면 dedupe가 해시 기준으로 종료된 축제를
  // 남기고 정상 관광지를 지워버릴 수 있었다 — 그러면 그 종료된 축제도 곧 위 필터에서 탈락해서
  // 그 위치의 유효 후보가 통째로 사라진다. 그래서 탈락시키는 필터(축제 날짜, 그리고 호출부가
  // 이미 적용해 pois에 반영된 relationship/adult_only)를 전부 거친 뒤에만 dedupe한다.
  // dedupeByCoordinate 자체의 로직(결정적 해시 선택)은 그대로 — 순서만 바뀌었다.
  pool = dedupeByCoordinate(pool);

  const scored = pool.map((p) => ({ ...p, __score: scorePoi(p, weights) }));
  const usedIds = new Set();

  const dayPlans = [];
  for (let i = 0; i < numDays; i += 1) {
    const date = dateForDayIndex(startDate, i);
    const anchor = scored
      .filter((p) => !usedIds.has(p.id))
      .filter((p) => (p.tags || []).includes('festival_event'))
      .filter((p) => festivalOverlapsDate(p, date))
      .sort(compareByField('__score'))[0] || null;

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
      .sort(compareByField('__combined'))
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
    .sort(compareByField('__score'))
    .slice(0, totalNonAnchorSlots);
  const festivalLeftover = freePool.filter((p) => (p.tags || []).includes('festival_event'));
  const clusters = kMeansCluster(topPool, Math.max(nonAnchorDays.length, 1));

  let leftover = festivalLeftover.slice();
  nonAnchorDays.forEach((dp, idx) => {
    const cluster = (clusters[idx] || []).slice().sort(compareByField('__score'));
    dp.picked = cluster.slice(0, dp.slots);
    leftover = leftover.concat(cluster.slice(dp.slots));
  });
  nonAnchorDays.forEach((dp) => {
    // eslint-disable-next-line no-constant-condition
    while (dp.picked.length < dp.slots) {
      leftover.sort(compareByField('__score'));
      const idx = leftover.findIndex((p) => isDateEligible(p, dp.date));
      if (idx === -1) break; // 남은 leftover 중 이 날짜에 맞는 게 없음
      dp.picked.push(leftover[idx]);
      leftover.splice(idx, 1);
    }
  });

  // P0(라운드8) — 하루 스탑의 과반이 같은 카테고리가 되지 않게 후처리(§1 "가중치가 전부 0일 때"
  // 상자 2번). 계약 확정 문구: "가중치가 일부라도 0이 아닌 경우엔 기존 스코어링이 그대로
  // 우선한다 — 1·2는 동점 구간에만 개입한다." 가중치가 하나라도 있으면 스코어 차이 자체가
  // 진짜 취향 반영이라(예: 온천만 원해서 하루가 onsen_wellness 일색이어도 의도된 결과), 이
  // 후처리는 가중치가 전부 0일 때만 돌린다 — 그 경우에만 전부 동점이라 개입할 "동점 구간"이다.
  const allWeightsZero = Object.values(weights).every((w) => !w);
  if (allWeightsZero) {
    enforceCategoryDiversity(dayPlans, scored);
  }

  // days는 여행 기간 전 일자를 빠짐없이·순서대로 반환한다 — day는 1부터 연속, date는 KST
  // YYYY-MM-DD (API_CONTRACT.md §1 "days 배열 불변식", 라운드3 점검 #4). 라운드2에서 스탑 0개인
  // day를 배열에서 아예 빼는 방식으로 고쳤었는데, 그러면 day 번호에 구멍이 생겨 프론트가 방어
  // 코드를 짜야 하고(3일 여행에 [{day:3}]만 오는 경우가 실제 확인됨) 날짜를 클라이언트가
  // 재계산하면서 KST 버그가 화면단에서 되살아난다. 추천할 장소가 없는 날은 stops:[]로 그대로
  // 반환 — "200으로 준 코스가 저장 시 400" 불일치는 validators.js 쪽 완화로 별도 해결(§ 관련 커밋).
  return dayPlans.map((dp, idx) => {
    const stops = dp.anchor ? [dp.anchor, ...dp.picked] : dp.picked;
    const ordered = twoOptOptimize(stops, { pinFirst: !!dp.anchor });
    return {
      day: dayNumberOffset + idx + 1,
      date: dp.date.toISOString().slice(0, 10),
      region_code: regionCode,
      // travel_from_prev_day는 시군 간 이동(카카오모빌리티)이라 여기서 계산 안 함 — 호출부가
      // 전체 days 배열을 조립한 뒤 한 번에 채운다(day 1 항상 null, 이후는 전날 마지막 스탑 기준).
      travel_from_prev_day: null,
      stops: ordered.map((p, i) => toStopShape(p, i + 1)),
    };
  });
}

/**
 * regenerate-stop 후보 / alerts trigger candidate_poi 공용 (라운드5 【3】) — toStopShape와 같은
 * name/is_indoor 객체화 규칙을 쓰되, order/blurb/travel_from_prev는 그 호출부 문맥에서 각자 채운다.
 */
function toCandidateShape(poi) {
  return {
    poi_id: poi.id,
    name: { ko: poi.name, en: poi.name_en ?? null, zh: poi.name_zh ?? null },
    category: resolveMasterCategory(poi),
    is_indoor: poi.is_indoor ?? false,
    lat: poi.lat,
    lng: poi.lng,
  };
}

/**
 * 부분 재구성 (PRD 3.5절) — 후보 최대 3개 (수동) 또는 1개(자동 매니징) 반환용.
 */
function pickTopCandidates(pois, weights, { excludePoiIds = [], limit = 3 } = {}) {
  const excludeSet = new Set(excludePoiIds);
  // P0(라운드8) — 후보 목록도 동일 좌표 중복 제거 + 결정적 동점 처리를 똑같이 적용한다
  // (regenerate-stop이 free_text 없이 "다시 추천"만 눌린 경우도 가중치가 전부 0일 수 있다).
  return dedupeByCoordinate(pois.filter((p) => !excludeSet.has(p.id)))
    .map((p) => ({ ...p, __score: scorePoi(p, weights) }))
    .sort(compareByField('__score'))
    .slice(0, limit);
}

module.exports = {
  scorePoi,
  filterByRelationship,
  daysCount,
  dateForDayIndex,
  addDaysToDateString,
  festivalOverlapsDate,
  festivalOverlapsRange,
  buildItineraryDays,
  pickTopCandidates,
  toStopShape,
  toCandidateShape,
  sanitizeStoredDays,
};
