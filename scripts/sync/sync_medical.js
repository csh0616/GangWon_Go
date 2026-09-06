// PRD 5장 — 의료관광정보 서비스 배치 동기화 (여행 케어 안내용 병원/응급 데이터).
//
// 블로커 (docs/HANDOFF_LOG.md 참고): 공공데이터포털 "의료관광정보 서비스" API는 서비스키 발급 전이라
// 실제 응답 스키마를 이 세션에서 확인하지 못했다. 아래는 TourAPI류 공공데이터 API의 공통 관례
// (serviceKey/MobileOS/_type 쿼리, response.body.items.item 배열)를 따른 자리표시자 구조이며,
// 서비스키 발급 후 실제 응답 필드명(병원명/전화번호/좌표 등)에 맞춰 매핑 부분만 수정하면 된다.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const BASE_URL = process.env.MEDICAL_TOURISM_BASE_URL || 'https://apis.data.go.kr/B551011/MedicalTourismService';
const SERVICE_KEY = process.env.MEDICAL_TOURISM_SERVICE_KEY;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const REGION_CODES = ['injae', 'hongcheon', 'pyeongchang'];

async function fetchMedicalFacilities(regionCode) {
  if (!SERVICE_KEY) {
    throw new Error('MEDICAL_TOURISM_SERVICE_KEY가 설정되지 않았습니다 — 공공데이터포털에서 발급 필요.');
  }
  const query = new URLSearchParams({
    serviceKey: SERVICE_KEY,
    MobileOS: 'ETC',
    MobileApp: 'GangwonGo',
    _type: 'json',
    numOfRows: '50',
    // TODO: 실제 API의 지역 필터 파라미터명 확인 후 교체 (areaCode/sigunguCode 방식일 가능성 높음)
    keyword: regionCode,
  });
  const res = await fetch(`${BASE_URL}/getMedicalInstitutionList?${query.toString()}`);
  if (!res.ok) throw new Error(`의료관광정보 API 호출 실패: HTTP ${res.status}`);
  const json = await res.json();
  const items = json?.response?.body?.items?.item;
  return items ? (Array.isArray(items) ? items : [items]) : [];
}

async function syncRegion(regionCode, syncStartedAt) {
  const items = await fetchMedicalFacilities(regionCode);
  const rows = items.map((raw) => ({
    region_code: regionCode,
    name: raw.name || raw.institutionName, // TODO: 실제 필드명 확인
    category: 'hospital',
    phone: raw.telNo || raw.phone || null, // TODO: 실제 필드명 확인
    lat: raw.latitude ? Number(raw.latitude) : null,
    lng: raw.longitude ? Number(raw.longitude) : null,
    synced_at: syncStartedAt,
  }));

  if (rows.length === 0) {
    console.warn(`[sync_medical] ${regionCode}: 결과 0건`);
    return;
  }

  // INSERT 먼저, 성공한 뒤에만 이전 데이터 DELETE (sync_pois.js와 동일 패턴, 1주차 점검 #15 —
  // 실패 시 "마지막 성공 데이터 유지" 원칙을 실제로 지키기 위함).
  const { error: insertErr } = await supabase.from('care_facilities').insert(rows);
  if (insertErr) throw insertErr;

  const { error: deleteErr } = await supabase
    .from('care_facilities')
    .delete()
    .eq('region_code', regionCode)
    .eq('category', 'hospital')
    .lt('synced_at', syncStartedAt);
  if (deleteErr) throw deleteErr;

  console.log(`[sync_medical] ${regionCode}: ${rows.length}건 동기화 완료`);
}

async function main() {
  for (const regionCode of REGION_CODES) {
    try {
      const syncStartedAt = new Date().toISOString();
      // eslint-disable-next-line no-await-in-loop
      await syncRegion(regionCode, syncStartedAt);
    } catch (err) {
      console.error(`[sync_medical] ${regionCode} 동기화 실패:`, err.message);
    }
  }
}

main();
