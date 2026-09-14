// PRD 5장/8장 — 여행 케어 안내 배치 동기화. 실행: `node sync_care.js` (TOURAPI_SERVICE_KEY 재사용,
// ANTHROPIC_API_KEY로 name_en/name_zh 1회 생성 — 전부 server/.env 폴백으로 읽음).
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { fetchAllEmergencyFacilities, fetchHospitalsAndClinics } = require('./care_sources');
const { translateName } = require('./translate_name');
const { isValidKoreaCoord } = require('./geo_validate');
const { mapWithConcurrency } = require('./concurrency');

const TRANSLATE_CONCURRENCY = 8;
const REGION_KEYWORDS = { injae: '인제군', hongcheon: '홍천군', pyeongchang: '평창군' };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function detectRegionByAddress(addr) {
  const found = Object.entries(REGION_KEYWORDS).find(([, keyword]) => (addr || '').includes(keyword));
  return found ? found[0] : null;
}

// 라운드6 【2】 — 전국 병·의원 찾기 서비스의 dutyDivNam(치과의원/보건소/의원/한의원/병원/종합병원/
// 요양병원/기타(구급차) 등 실측 확인)을 API_CONTRACT.md §4 category로 매핑한다. "기타(구급차)"처럼
// 실제로 찾아갈 수 있는 의료기관이 아닌 항목은 null을 반환해 후보에서 제외한다 — 건수를 채우려고
// 애매한 항목까지 넣지 않는다(PRD 8장 원칙).
function hospitalCategoryFor(dutyDivNam) {
  const name = dutyDivNam || '';
  if (name.includes('보건소')) return 'health_center';
  if (name.includes('병원')) return 'hospital'; // 병원/종합병원/요양병원
  if (name.includes('의원')) return 'clinic'; // 의원/치과의원/한의원
  return null;
}

async function buildEmergencyRows(syncStartedAt) {
  const all = await fetchAllEmergencyFacilities();
  const candidates = all
    .map((raw) => ({ raw, regionCode: detectRegionByAddress(raw.dutyAddr) }))
    .filter(({ regionCode }) => regionCode)
    .filter(({ raw }) => {
      const ok = isValidKoreaCoord(Number(raw.wgs84Lat), Number(raw.wgs84Lon));
      if (!ok) console.warn(`[sync_care] 응급의료기관 좌표 범위 밖 제외 - ${raw.dutyName}`);
      return ok;
    });

  return mapWithConcurrency(candidates, TRANSLATE_CONCURRENCY, async ({ raw, regionCode }) => {
    const nameKo = raw.dutyName;
    const { en: nameEn, zh: nameZh } = await translateName(nameKo, 'care');
    console.log(`[sync_care] 응급의료기관 ${nameKo} (${regionCode}) 번역 완료`);
    return {
      content_id: `care-emerg-${raw.hpid}`,
      region_code: regionCode,
      name_ko: nameKo,
      name_en: nameEn,
      name_zh: nameZh,
      category: 'emergency_room',
      phone: raw.dutyTel1 || null,
      address_ko: raw.dutyAddr,
      lat: Number(raw.wgs84Lat),
      lng: Number(raw.wgs84Lon),
      synced_at: syncStartedAt,
    };
  });
}

async function buildHospitalClinicRows(syncStartedAt) {
  const perRegion = await Promise.all(
    Object.entries(REGION_KEYWORDS).map(async ([regionCode, sggName]) => {
      const rows = await fetchHospitalsAndClinics(sggName);
      return rows.map((raw) => ({ raw, regionCode }));
    })
  );
  const candidates = perRegion
    .flat()
    .map(({ raw, regionCode }) => ({ raw, regionCode, category: hospitalCategoryFor(raw.dutyDivNam) }))
    .filter(({ category, raw }) => {
      if (!category) {
        console.warn(`[sync_care] 분류 불가(비의료기관으로 판단) 제외 - ${raw.dutyName} (${raw.dutyDivNam})`);
        return false;
      }
      const ok = isValidKoreaCoord(Number(raw.wgs84Lat), Number(raw.wgs84Lon));
      if (!ok) console.warn(`[sync_care] 병·의원 좌표 범위 밖 제외 - ${raw.dutyName}`);
      return ok;
    });

  return mapWithConcurrency(candidates, TRANSLATE_CONCURRENCY, async ({ raw, regionCode, category }) => {
    const nameKo = raw.dutyName;
    const { en: nameEn, zh: nameZh } = await translateName(nameKo, 'care');
    console.log(`[sync_care] 병·의원 ${nameKo} (${regionCode}, ${raw.dutyDivNam} → ${category}) 번역 완료`);
    return {
      content_id: `care-hosp-${raw.hpid}`,
      region_code: regionCode,
      name_ko: nameKo,
      name_en: nameEn,
      name_zh: nameZh,
      category,
      phone: raw.dutyTel1 || null,
      address_ko: raw.dutyAddr,
      lat: Number(raw.wgs84Lat),
      lng: Number(raw.wgs84Lon),
      synced_at: syncStartedAt,
    };
  });
}

async function main() {
  const syncStartedAt = new Date().toISOString();
  let rows = [];
  try {
    const [emergencyRows, hospitalRows] = await Promise.all([
      buildEmergencyRows(syncStartedAt),
      buildHospitalClinicRows(syncStartedAt),
    ]);
    rows = [...emergencyRows, ...hospitalRows];
  } catch (err) {
    console.error('[sync_care] 데이터 수집 실패:', err.message, err.cause ? `| cause: ${err.cause}` : '');
    return;
  }

  if (rows.length === 0) {
    console.warn('[sync_care] 매칭된 시설이 0건입니다.');
    return;
  }

  const { error: upsertErr } = await supabase.from('care_facilities').upsert(rows, { onConflict: 'content_id' });
  if (upsertErr) {
    console.error('[sync_care] upsert 실패:', upsertErr.message);
    return;
  }

  // 지역별로 이번 실행보다 오래된 로우 정리(sync_pois.js와 동일 패턴) — 폐기된 보건기관표준데이터
  // 로우(content_id가 'care-health-'로 시작, PRD 5장)도 synced_at이 더 예전이라 자동으로 정리된다.
  const regionCodes = [...new Set(rows.map((r) => r.region_code))];
  const { error: cleanupErr } = await supabase.from('care_facilities').delete().in('region_code', regionCodes).lt('synced_at', syncStartedAt);
  if (cleanupErr) {
    console.error('[sync_care] 정리 실패:', cleanupErr.message);
    return;
  }

  const byRegion = {};
  rows.forEach((r) => {
    byRegion[r.region_code] = (byRegion[r.region_code] || 0) + 1;
  });
  console.log(`[sync_care] 총 ${rows.length}건 동기화 완료`, byRegion);
}

main();
