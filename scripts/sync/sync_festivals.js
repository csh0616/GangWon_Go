// PRD 5장 — 전국문화축제표준데이터(행안부 표준데이터) 배치 동기화. TourAPI의 축제 콘텐츠타입(15)이
// 강원 3개 시군에 거의 등록돼 있지 않아(인제 0/홍천 0/평창 2) 보완용으로 추가 (라운드3 P1).
// 실행: `node sync_festivals.js` (.env의 FESTIVAL_SERVICE_KEY/FESTIVAL_BASE_URL 필요)
require('dotenv').config();
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { isValidKoreaCoord } = require('./geo_validate');

const BASE_URL = process.env.FESTIVAL_BASE_URL;
const SERVICE_KEY = process.env.FESTIVAL_SERVICE_KEY;
const PAGE_SIZE = 1000;
const PAGE_COUNT = 2; // totalCount 1,305건 확인됨 (2026-09 실측) — 1000×2페이지면 전량 커버

// 주소(rdnmadr/lnmadr)에 이 문자열이 포함되면 해당 시군으로 판별. "군" 접미사까지 넣어 다른
// 시군 이름에 우연히 부분일치하는 걸 방지.
const REGION_KEYWORDS = {
  injae: '인제군',
  hongcheon: '홍천군',
  pyeongchang: '평창군',
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function fetchPage(pageNo) {
  if (!SERVICE_KEY || !BASE_URL) {
    throw new Error('FESTIVAL_SERVICE_KEY/FESTIVAL_BASE_URL이 설정되지 않았습니다 (.env 확인).');
  }
  const query = new URLSearchParams({ pageNo: String(pageNo), numOfRows: String(PAGE_SIZE), type: 'json' });
  // serviceKey 이중 인코딩 방지 (라운드3 P0) — 같은 공공데이터포털 키 체계, tourapi_client.js와 동일 이유
  const url = `${BASE_URL}?serviceKey=${SERVICE_KEY}&${query.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`전국문화축제표준데이터 API 호출 실패: HTTP ${res.status}`);
  const json = await res.json();
  // 주의: 이 API는 TourAPI/의료관광정보와 달리 최상위가 `response.body`가 아니라 `body` 바로 아래다
  // (실측 확인 — 응답 최상위 키가 header/body).
  const items = json?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

async function fetchAllFestivals() {
  const pages = await Promise.all(Array.from({ length: PAGE_COUNT }, (_, i) => fetchPage(i + 1)));
  return pages.flat();
}

function detectRegionCode(item) {
  const addr = `${item.rdnmadr || ''} ${item.lnmadr || ''}`;
  const found = Object.entries(REGION_KEYWORDS).find(([, keyword]) => addr.includes(keyword));
  return found ? found[0] : null;
}

// 이 데이터셋엔 고유 ID 필드가 없다 — insttCode + 축제명 + 시작일 조합으로 안정적인 키를 만든다.
// 매 동기화마다 값이 달라지면 upsert가 깨지고 중복이 쌓이므로, 원본 필드만으로 결정론적으로 생성
// (임의 요소 없음 — 같은 입력이면 항상 같은 content_id).
function buildContentId(item) {
  const raw = `${item.insttCode || ''}|${item.fstvlNm || ''}|${item.fstvlStartDate || ''}`;
  const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 12);
  return `fest-${item.insttCode || 'unknown'}-${hash}`;
}

async function main() {
  let rawItems;
  try {
    rawItems = await fetchAllFestivals();
  } catch (err) {
    console.error('[sync_festivals] 전체 목록 조회 실패:', err.message, err.cause ? `| cause: ${err.cause}` : '');
    return;
  }
  console.log(`[sync_festivals] 전국 ${rawItems.length}건 수신`);

  const rowsByRegion = { injae: [], hongcheon: [], pyeongchang: [] };
  let skippedNoRegion = 0;
  let skippedNoCoord = 0;
  let skippedNoDate = 0;

  for (const raw of rawItems) {
    const regionCode = detectRegionCode(raw);
    if (!regionCode) {
      skippedNoRegion += 1;
      continue; // eslint-disable-line no-continue
    }

    // 과거 연도 로우는 좌표가 비어 있는 경우가 많다(PM 확정) — 빈 값/파싱 실패/한국 밖 좌표 전부 제외.
    if (!raw.latitude || !raw.longitude) {
      skippedNoCoord += 1;
      continue; // eslint-disable-line no-continue
    }
    const lat = Number(raw.latitude);
    const lng = Number(raw.longitude);
    if (!isValidKoreaCoord(lat, lng)) {
      skippedNoCoord += 1;
      continue; // eslint-disable-line no-continue
    }

    // fstvlStartDate/EndDate는 이미 YYYY-MM-DD 형식으로 온다 (실측 확인) — 형식이 아니면 날짜 필터가
    // 무의미해지므로(3.5절 festivalOverlapsDate) 제외.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.fstvlStartDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(raw.fstvlEndDate || '')) {
      skippedNoDate += 1;
      continue; // eslint-disable-line no-continue
    }

    rowsByRegion[regionCode].push({
      content_id: buildContentId(raw),
      region_code: regionCode,
      name: raw.fstvlNm,
      category: '지역축제',
      lat,
      lng,
      tags: ['festival_event'],
      event_start_date: raw.fstvlStartDate,
      event_end_date: raw.fstvlEndDate,
      // 과거 연도 축제가 다수 포함되지만 코스 배치 시 일자 필터(scoring.js festivalOverlapsDate)에
      // 걸려 자동 제외되므로 무해하다 (PM 확정) — 별도 연도 필터링 없이 전부 적재.
      synced_at: new Date().toISOString(),
    });
  }

  console.log(`[sync_festivals] 지역 밖 제외 ${skippedNoRegion}건, 좌표 없음/무효 제외 ${skippedNoCoord}건, 날짜 형식 이상 제외 ${skippedNoDate}건`);

  for (const [regionCode, rows] of Object.entries(rowsByRegion)) {
    if (rows.length === 0) {
      console.warn(`[sync_festivals] ${regionCode}: 매칭된 축제가 0건입니다.`);
      continue; // eslint-disable-line no-continue
    }
    try {
      const syncStartedAt = rows[0].synced_at;
      // eslint-disable-next-line no-await-in-loop
      const { error: upsertErr } = await supabase.from('pois').upsert(rows, { onConflict: 'content_id' });
      if (upsertErr) throw upsertErr;

      // 이 지역의 festival_event 태그 로우 중 이번 실행보다 오래된 것만 정리 — 다른 카테고리(TourAPI
      // 동기화분)는 건드리지 않는다. sync_pois.js와 같은 synced_at 기준 정리 패턴(라운드3 점검 #7).
      // eslint-disable-next-line no-await-in-loop
      const { error: cleanupErr } = await supabase
        .from('pois')
        .delete()
        .eq('region_code', regionCode)
        .contains('tags', ['festival_event'])
        .lt('synced_at', syncStartedAt);
      if (cleanupErr) throw cleanupErr;

      console.log(`[sync_festivals] ${regionCode}: ${rows.length}건 동기화 완료`);
    } catch (err) {
      console.error(`[sync_festivals] ${regionCode} 동기화 실패:`, err.message, err.cause ? `| cause: ${err.cause}` : '');
    }
  }
}

main();
