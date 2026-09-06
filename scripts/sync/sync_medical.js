// PRD 5장 — 의료관광정보 서비스(MdclTursmService) 배치 동기화. 실행: `node sync_medical.js`
// (MEDICAL_TOURISM_SERVICE_KEY 필요, 사용 전 ldong_lookup.js로 medical_client.js의
// REGION_TO_LDONG을 먼저 채워야 함). 스펙은 docs/HANDOFF_LOG.md 2026-09-07 00:30 항목
// (공식 매뉴얼 v4.1 기준, "추측 금지")을 그대로 구현 — 라운드1의 자리표시자 버전을 전면 교체.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { fetchAreaBasedList } = require('./medical_client');

const REGION_CODES = ['injae', 'hongcheon', 'pyeongchang'];

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function syncRegion(regionCode) {
  // langDivCd는 ENG/JPN/CHS/RUS만 있고 한국어가 없다(PM 확정) — ENG·CHS 두 번 호출해
  // contentId 기준으로 같은 row에 합친다.
  const [enItems, zhItems] = await Promise.all([fetchAreaBasedList(regionCode, 'ENG'), fetchAreaBasedList(regionCode, 'CHS')]);

  const byContentId = new Map();
  enItems.forEach((raw) => {
    byContentId.set(raw.contentId, {
      content_id: raw.contentId,
      name_en: raw.title || null,
      address_en: raw.baseAddr || null,
      phone: raw.tel || null,
      lat: raw.mapY ? Number(raw.mapY) : null,
      lng: raw.mapX ? Number(raw.mapX) : null,
    });
  });
  zhItems.forEach((raw) => {
    const existing = byContentId.get(raw.contentId) || {
      content_id: raw.contentId,
      phone: raw.tel || null,
      lat: raw.mapY ? Number(raw.mapY) : null,
      lng: raw.mapX ? Number(raw.mapX) : null,
    };
    existing.name_zh = raw.title || null;
    existing.address_zh = raw.baseAddr || null;
    byContentId.set(raw.contentId, existing);
  });

  const rows = Array.from(byContentId.values()).map((r) => ({
    content_id: r.content_id,
    region_code: regionCode,
    name_en: r.name_en || null,
    name_zh: r.name_zh || null,
    // 응답에 시설 종류 구분이 없다(PM 확정) — 일단 hospital 고정, 필요해지면 /detailMdclTursm으로 보강
    category: 'hospital',
    phone: r.phone,
    address_en: r.address_en || null,
    address_zh: r.address_zh || null,
    lat: r.lat,
    lng: r.lng,
    synced_at: new Date().toISOString(),
  }));

  if (rows.length === 0) {
    console.warn(`[sync_medical] ${regionCode}: 결과 0건`);
    return;
  }

  // content_id 기준 upsert (pois의 content_id upsert와 동일 원칙, 라운드2 점검 #4)
  const { error: upsertErr } = await supabase.from('care_facilities').upsert(rows, { onConflict: 'content_id' });
  if (upsertErr) throw upsertErr;

  // 이 API가 채우는 건 category='hospital'뿐이다. seed_care.js가 채운 clinic/emergency 픽스처는
  // 건드리지 않고, 0001/구버전 시절 content_id 없이 들어간 hospital 레거시 로우만 정리한다.
  const { error: cleanupErr } = await supabase
    .from('care_facilities')
    .delete()
    .eq('region_code', regionCode)
    .eq('category', 'hospital')
    .is('content_id', null);
  if (cleanupErr) throw cleanupErr;

  console.log(`[sync_medical] ${regionCode}: ${rows.length}건 동기화 완료`);
}

async function main() {
  for (const regionCode of REGION_CODES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await syncRegion(regionCode);
    } catch (err) {
      // err.cause까지 로깅 — err.message만 찍으면 네트워크 계열 실패는 "fetch failed"만 보여서
      // 진단이 안 된다 (라운드2 점검 #8).
      console.error(`[sync_medical] ${regionCode} 동기화 실패:`, err.message, err.cause ? `| cause: ${err.cause}` : '');
    }
  }
}

main();
