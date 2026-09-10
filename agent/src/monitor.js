// PRD 3.5절/3.6절 — 실시간 조건 감시. server/의 alertTrigger.js를 그대로 재사용해 로직 중복을 막는다.
const path = require('path');
const { supabaseAdmin } = require(path.join(__dirname, '../../server/src/config/supabaseClient'));
const { createProposedAlert, dismissExpiredProposals } = require(path.join(__dirname, '../../server/src/lib/alertTrigger'));
const { getDrivingDurationSeconds } = require(path.join(__dirname, '../../server/src/lib/directions'));
const { todayKstISO } = require(path.join(__dirname, '../../server/src/lib/time'));
const { fetchRainStatus } = require('./weather');

const TRAFFIC_THRESHOLD_SECONDS = 60 * 60; // 1시간 초과 (PRD 3.5절)
const RAIN_TAGS = ['nature_hiking', 'leisure_sports', 'festival_event'];

// PRD 6장(1주차 점검 #4) — "오늘"은 KST 기준. toISOString()(UTC)을 쓰면 한국 새벽 0~9시 사이에
// 전날 일정을 스캔하거나 당일치기 일정이 감시 대상에서 통째로 빠지는 조용한 실패가 생겼다.
function tripDayIndex(startDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const today = new Date(`${todayKstISO()}T00:00:00Z`);
  return Math.round((today - start) / (1000 * 60 * 60 * 24)) + 1;
}

async function fetchActiveItinerariesInProgress() {
  const today = todayKstISO();
  const { data, error } = await supabaseAdmin
    .from('itineraries')
    .select('*')
    .eq('status', 'active')
    .lte('start_date', today)
    .gte('end_date', today);
  if (error) throw error;
  return data;
}

async function checkRain(itinerary, dayEntry) {
  const regionCode = itinerary.region_codes[0];
  let rainStatus;
  try {
    rainStatus = await fetchRainStatus(regionCode);
  } catch (err) {
    console.warn(`[monitor] ${regionCode} 날씨 조회 실패, 이번 주기는 건너뜀:`, err.message);
    return;
  }
  if (!rainStatus.isRaining) return;

  // itinerary_json 스냅샷엔 tags가 없으므로(ERD_SEQUENCE.md §1 스냅샷 정책), 결정 순간엔 최신
  // pois를 다시 조회해 태그를 확인한다 — 매니징/수동 편집이 항상 최신 pois로 재스코어링하는 것과 동일 원칙.
  const poiIds = dayEntry.stops.map((s) => s.poi_id);
  const { data: poiRows, error: poiErr } = await supabaseAdmin.from('pois').select('id, tags').in('id', poiIds);
  if (poiErr) {
    console.warn('[monitor] 스탑 태그 조회 실패, 이번 주기는 건너뜀:', poiErr.message);
    return;
  }
  // 요청 id 수와 반환 건수가 다르면 경고한다 (라운드3 점검 #8 — 이전엔 0건일 때만 경고해서, 4스탑 중
  // 3건만 매칭되는 부분 불일치는 조용히 넘어갔다). poi_id가 최신 pois와 안 맞는다는 뜻이라, 재동기화가
  // content_id 기반 upsert 없이 돌아서 uuid가 갈렸을 가능성이 높다. 에러가 아니라 정상 응답(부분/빈
  // 배열)이라 poiErr로는 안 걸러지므로 여기서 별도로 확인한다.
  if (poiRows.length !== poiIds.length) {
    console.warn(
      `[monitor] itinerary ${itinerary.id} day ${dayEntry.day}: pois 재조회 ${poiIds.length}건 요청 → ${poiRows.length}건 응답 (일부 poi_id가 최신 pois와 안 맞음 — 재동기화가 content_id 기반 upsert로 됐는지 확인 필요).`
    );
  }
  if (poiRows.length === 0) return;
  const tagsById = new Map(poiRows.map((p) => [p.id, p.tags || []]));
  const target = dayEntry.stops.find((s) => (tagsById.get(s.poi_id) || []).some((tag) => RAIN_TAGS.includes(tag)));
  if (!target) return;

  await createProposedAlert({
    itineraryId: itinerary.id,
    userId: itinerary.user_id,
    triggerType: 'weather',
    condition: 'rain',
    day: dayEntry.day,
    targetPoiId: target.poi_id,
  });
}

async function checkTraffic(itinerary, dayEntry) {
  const { stops } = dayEntry;
  for (let i = 0; i < stops.length - 1; i += 1) {
    let duration;
    try {
      // eslint-disable-next-line no-await-in-loop
      duration = await getDrivingDurationSeconds(stops[i], stops[i + 1]);
    } catch (err) {
      console.warn('[monitor] 구간 이동시간 조회 실패:', err.message);
      // eslint-disable-next-line no-continue
      continue;
    }
    if (duration > TRAFFIC_THRESHOLD_SECONDS) {
      // eslint-disable-next-line no-await-in-loop
      await createProposedAlert({
        itineraryId: itinerary.id,
        userId: itinerary.user_id,
        triggerType: 'traffic',
        condition: 'traffic',
        day: dayEntry.day,
        targetPoiId: stops[i + 1].poi_id,
      });
      return; // PRD 3.5절 — "1시간 넘는 첫 구간"만 처리
    }
  }
}

async function scanAndTrigger() {
  const itineraries = await fetchActiveItinerariesInProgress();

  for (const itinerary of itineraries) {
    // dayEntry 조회까지 try 안으로 옮김 (1주차 점검 #8) — 이전엔 itinerary_json이 기형(days 없음 등)인
    // row 하나가 여기서 던지면 try 밖이라 scanAndTrigger 전체가 죽고, 그 뒤 itinerary들이 이번 주기는
    // 물론 다음 주기에도 영원히 스캔 안 되는 문제가 있었다 (같은 기형 row가 매번 먼저 걸리므로).
    try {
      const dayIndex = tripDayIndex(itinerary.start_date);
      const dayEntry = itinerary.itinerary_json?.days?.find((d) => d.day === dayIndex);
      // days 배열이 전 일자를 반환하게 되면서(API_CONTRACT.md §1 불변식, 라운드3) stops:[]인 날이
      // 정상적으로 존재한다 — 스탑이 없으면 감시할 것도 없으므로 건너뛴다(경고 아님, 정상 상태).
      if (!dayEntry || dayEntry.stops.length === 0) continue; // eslint-disable-line no-continue

      // eslint-disable-next-line no-await-in-loop
      await checkRain(itinerary, dayEntry);
      // eslint-disable-next-line no-await-in-loop
      await checkTraffic(itinerary, dayEntry);
    } catch (err) {
      console.error(`[monitor] itinerary ${itinerary.id} 스캔 중 오류:`, err.message);
    }
  }
}

async function tick() {
  try {
    await dismissExpiredProposals();
  } catch (err) {
    console.error('[monitor] dismissExpiredProposals 실패:', err.message);
  }
  try {
    await scanAndTrigger();
  } catch (err) {
    console.error('[monitor] scanAndTrigger 실패:', err.message);
  }
}

module.exports = { tick };
