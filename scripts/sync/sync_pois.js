// PRD 5장/3.6절 — TourAPI 배치 동기화 (하루~일주일 단위). 실행: `node sync_pois.js`
// 사용 전 .env에 SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/TOURAPI_SERVICE_KEY 필요.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { fetchAreaBasedList, fetchFestivalDates } = require('./tourapi_client');
const { mapTourApiCategory } = require('./category_mapping');

const REGION_CODES = ['injae', 'hongcheon', 'pyeongchang'];
// 대한민국 대략 경계 — (0,0) 등 좌표 누락/파싱 실패 로우를 걸러내기 위한 sanity check (1주차 점검 #14)
const KOREA_LAT_RANGE = [33, 39];
const KOREA_LNG_RANGE = [124, 132];

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function isValidKoreaCoord(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= KOREA_LAT_RANGE[0] &&
    lat <= KOREA_LAT_RANGE[1] &&
    lng >= KOREA_LNG_RANGE[0] &&
    lng <= KOREA_LNG_RANGE[1]
  );
}

async function syncRegion(regionCode, syncStartedAt) {
  const rawItems = await fetchAreaBasedList(regionCode);
  const rows = [];

  for (const raw of rawItems) {
    const tag = mapTourApiCategory(raw);
    if (!tag) continue; // 7개 카테고리 밖 콘텐츠(숙박/여행코스 등) — PRD 2.3절 스코프 밖, 동기화 제외

    // TourAPI가 좌표를 빈 문자열로 주는 로우가 있다 — Number('')는 0이라 (0,0) 아프리카 앞바다
    // 좌표가 정상 POI처럼 삽입되고, 코스에 ~11,000km 구간이 생기는 사고가 있었다 (1주차 점검 #14).
    if (!raw.mapx || !raw.mapy) {
      console.warn(`[sync_pois] ${regionCode}: 좌표 없는 로우 제외 - ${raw.title}`);
      continue;
    }
    const lat = Number(raw.mapy); // TourAPI: mapx=경도, mapy=위도
    const lng = Number(raw.mapx);
    if (!isValidKoreaCoord(lat, lng)) {
      console.warn(`[sync_pois] ${regionCode}: 좌표 범위 밖 로우 제외 - ${raw.title} (${lat}, ${lng})`);
      continue;
    }

    let eventStartDate = null;
    let eventEndDate = null;
    if (tag === 'festival_event') {
      // eslint-disable-next-line no-await-in-loop
      const dates = await fetchFestivalDates(raw.contentid, raw.contenttypeid);
      eventStartDate = dates.eventStartDate;
      eventEndDate = dates.eventEndDate;
    }

    rows.push({
      region_code: regionCode,
      name: raw.title,
      category: raw.cat3 || raw.cat2 || raw.cat1 || 'unknown',
      lat,
      lng,
      tags: [tag],
      event_start_date: eventStartDate,
      event_end_date: eventEndDate,
      synced_at: syncStartedAt,
    });
  }

  if (rows.length === 0) {
    console.warn(`[sync_pois] ${regionCode}: 매핑된 POI가 0건입니다.`);
    return;
  }

  // 먼저 INSERT하고, 성공한 뒤에만 이 실행 이전(synced_at < syncStartedAt) 데이터를 DELETE한다
  // (1주차 점검 #15 — 기존엔 DELETE가 먼저 커밋되고 INSERT가 실패하면 그 시군 POI가 0건이 되어
  // "실패 시 마지막 성공 데이터 유지" 원칙과 반대로 동작했다). INSERT가 실패하면 DELETE 자체가
  // 실행되지 않아 기존 데이터가 그대로 남는다.
  const { error: insertErr } = await supabase.from('pois').insert(rows);
  if (insertErr) throw insertErr;

  const { error: deleteErr } = await supabase.from('pois').delete().eq('region_code', regionCode).lt('synced_at', syncStartedAt);
  if (deleteErr) throw deleteErr;

  console.log(`[sync_pois] ${regionCode}: ${rows.length}건 동기화 완료`);
}

async function main() {
  for (const regionCode of REGION_CODES) {
    try {
      const syncStartedAt = new Date().toISOString();
      // eslint-disable-next-line no-await-in-loop
      await syncRegion(regionCode, syncStartedAt);
    } catch (err) {
      // PRD 6장 — 배치 동기화 실패는 사용자 화면에 직접 노출되는 실패가 아님. INSERT-then-DELETE
      // 순서 덕에 실패해도 DB의 마지막 성공 데이터가 그대로 남는다. 실패만 기록하고 다음 지역 계속 진행.
      console.error(`[sync_pois] ${regionCode} 동기화 실패:`, err.message);
    }
  }
}

main();
