// PRD 5장/3.6절 — TourAPI 배치 동기화 (하루~일주일 단위). 실행: `node sync_pois.js`
// 사용 전 .env에 SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/TOURAPI_SERVICE_KEY 필요.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { fetchAreaBasedList, fetchFestivalDates } = require('./tourapi_client');
const { mapTourApiCategory } = require('./category_mapping');

const REGION_CODES = ['injae', 'hongcheon', 'pyeongchang'];

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function syncRegion(regionCode) {
  const rawItems = await fetchAreaBasedList(regionCode);
  const rows = [];

  for (const raw of rawItems) {
    const tag = mapTourApiCategory(raw);
    if (!tag) continue; // 7개 카테고리 밖 콘텐츠(숙박/여행코스 등) — PRD 2.3절 스코프 밖, 동기화 제외

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
      lat: Number(raw.mapy), // TourAPI: mapx=경도, mapy=위도
      lng: Number(raw.mapx),
      tags: [tag],
      event_start_date: eventStartDate,
      event_end_date: eventEndDate,
      synced_at: new Date().toISOString(),
    });
  }

  if (rows.length === 0) {
    console.warn(`[sync_pois] ${regionCode}: 매핑된 POI가 0건입니다.`);
    return;
  }

  // TourAPI 원본엔 안정적인 자연키(예: 위경도+이름)가 없어 매 실행마다 새로 갈아끼운다 —
  // 데모 규모(시군당 수십 건)에서는 delete+insert가 upsert 충돌 처리보다 단순하고 안전하다.
  const { error: deleteErr } = await supabase.from('pois').delete().eq('region_code', regionCode);
  if (deleteErr) throw deleteErr;

  const { error: insertErr } = await supabase.from('pois').insert(rows);
  if (insertErr) throw insertErr;

  console.log(`[sync_pois] ${regionCode}: ${rows.length}건 동기화 완료`);
}

async function main() {
  for (const regionCode of REGION_CODES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await syncRegion(regionCode);
    } catch (err) {
      // PRD 6장 — 배치 동기화 실패는 사용자 화면에 노출되는 실패가 아님. DB의 마지막 성공 데이터를
      // 그대로 둔 채(위 delete는 성공한 region만 실행됨) 실패만 기록하고 다음 지역으로 계속 진행.
      console.error(`[sync_pois] ${regionCode} 동기화 실패:`, err.message);
    }
  }
}

main();
