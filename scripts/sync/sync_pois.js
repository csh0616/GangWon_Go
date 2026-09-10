// PRD 5장/3.6절 — TourAPI 배치 동기화 (하루~일주일 단위). 실행: `node sync_pois.js`
// 사용 전 .env에 SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/TOURAPI_SERVICE_KEY 필요.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { fetchAreaBasedList, fetchFestivalDates } = require('./tourapi_client');
const { mapTourApiCategory } = require('./category_mapping');
const { isValidKoreaCoord } = require('./geo_validate');

const REGION_CODES = ['injae', 'hongcheon', 'pyeongchang'];

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function syncRegion(regionCode) {
  // 이 지역의 요청 시작 전 시각 — 아래 정리 단계의 기준선(이 시각보다 오래된 로우는 이번 목록에
  // 없었다는 뜻이므로 삭제 대상).
  const syncStartedAt = new Date().toISOString();
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
      content_id: raw.contentid,
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

  // content_id 기준 upsert (라운드2 점검 #4) — id(uuid)가 재동기화 후에도 유지된다. 예전 delete+insert
  // 방식은 매번 새 uuid를 발급해서, itinerary_json 스냅샷의 옛 poi_id로 매니징 에이전트가 pois를
  // 재조회하면 0건이 되고 rain 트리거가 로그 한 줄 없이 영구 무동작이 되는 문제가 있었다.
  const { error: upsertErr } = await supabase.from('pois').upsert(rows, { onConflict: 'content_id' });
  if (upsertErr) throw upsertErr;

  // 이 지역에서 이번 목록에 없었던(= synced_at이 이번 실행보다 오래된) 로우 정리 (라운드3 점검 #7).
  // upsert 전환 이후 TourAPI 목록에서 사라진 POI(폐업/종료된 축제 등)가 영구히 남아 계속 코스에
  // 배치되는 문제가 있었다 — NULL-content_id 로우만 지우던 이전 방식으로는 못 잡았다. 시드
  // 로우(content_id가 'seed-'로 시작)도 이번 실행 기준 더 오래된 synced_at이라 자동으로 함께
  // 정리된다(PRD 8장 실데이터 전환 방침과 결과적으로 일치 — 다만 최초 전환은 명시적으로 한 번 확인).
  const { error: cleanupErr } = await supabase.from('pois').delete().eq('region_code', regionCode).lt('synced_at', syncStartedAt);
  if (cleanupErr) throw cleanupErr;

  console.log(`[sync_pois] ${regionCode}: ${rows.length}건 동기화 완료`);
}

async function main() {
  for (const regionCode of REGION_CODES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await syncRegion(regionCode);
    } catch (err) {
      // PRD 6장 — 배치 동기화 실패는 사용자 화면에 직접 노출되는 실패가 아님. upsert 방식이라
      // 실패해도 기존 로우가 그대로 남는다. err.cause까지 로깅 — err.message만 찍으면 네트워크
      // 계열 실패는 "fetch failed"만 보여서 진단이 안 된다(이번 TourAPI 장애 진단이 반나절 걸린
      // 직접적 원인, 라운드2 점검 #8). 실패만 기록하고 다음 지역 계속 진행.
      console.error(`[sync_pois] ${regionCode} 동기화 실패:`, err.message, err.cause ? `| cause: ${err.cause}` : '');
    }
  }
}

main();
