// PRD 5장/8장 — 여행 케어 안내 배치 동기화 (라운드5 【2】, MdclTursmService를 대체).
// 실행: `node sync_care.js` (TOURAPI_SERVICE_KEY 재사용, KAKAO_MOBILITY_API_KEY로 지오코딩,
// ANTHROPIC_API_KEY로 name_en/name_zh 1회 생성 — 전부 server/.env 폴백으로 읽음).
require('dotenv').config();
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { fetchAllEmergencyFacilities, fetchAllHealthInstitutions } = require('./care_sources');
const { geocodeAddress } = require('./geocode');
const { translateName } = require('./translate_name');
const { isValidKoreaCoord } = require('./geo_validate');

const REGION_KEYWORDS = { injae: '인제군', hongcheon: '홍천군', pyeongchang: '평창군' };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function detectRegionByAddress(addr) {
  const found = Object.entries(REGION_KEYWORDS).find(([, keyword]) => (addr || '').includes(keyword));
  return found ? found[0] : null;
}

function detectRegionBySgg(sggNm) {
  const found = Object.entries(REGION_KEYWORDS).find(([, keyword]) => sggNm === keyword);
  return found ? found[0] : null;
}

// htctTypeNm(보건소/보건지소/보건진료소) → API_CONTRACT.md §4 category enum
// (emergency_room/health_center/health_subcenter/hospital). 보건진료소는 보건지소보다도 더 소규모인
// 리 단위 1차 의료기관이라 health_subcenter로 묶는다 — 계약에 별도 카테고리가 없다.
function healthCategoryFor(htctTypeNm) {
  if ((htctTypeNm || '').includes('보건소')) return 'health_center';
  return 'health_subcenter'; // 보건지소, 보건진료소 등
}

function stableHash(input) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 12);
}

async function buildEmergencyRows(syncStartedAt) {
  const all = await fetchAllEmergencyFacilities();
  const rows = [];
  for (const raw of all) {
    const regionCode = detectRegionByAddress(raw.dutyAddr);
    if (!regionCode) continue; // eslint-disable-line no-continue
    const lat = Number(raw.wgs84Lat);
    const lng = Number(raw.wgs84Lon);
    if (!isValidKoreaCoord(lat, lng)) {
      console.warn(`[sync_care] 응급의료기관 좌표 범위 밖 제외 - ${raw.dutyName}`);
      continue; // eslint-disable-line no-continue
    }
    const nameKo = raw.dutyName;
    // eslint-disable-next-line no-await-in-loop
    const { en: nameEn, zh: nameZh } = await translateName(nameKo, 'care');
    rows.push({
      content_id: `care-emerg-${raw.hpid}`,
      region_code: regionCode,
      name_ko: nameKo,
      name_en: nameEn,
      name_zh: nameZh,
      category: 'emergency_room',
      phone: raw.dutyTel1 || null,
      address_ko: raw.dutyAddr,
      lat,
      lng,
      synced_at: syncStartedAt,
    });
    console.log(`[sync_care] 응급의료기관 ${nameKo} (${regionCode}) 번역 완료`);
  }
  return rows;
}

async function buildHealthInstitutionRows(syncStartedAt) {
  const all = await fetchAllHealthInstitutions();
  const rows = [];
  for (const raw of all) {
    const regionCode = detectRegionBySgg(raw.sggNm);
    if (!regionCode) continue; // eslint-disable-line no-continue

    const address = raw.lctnRoadNmAddr || raw.lctnLotnoAddr;
    if (!address) {
      console.warn(`[sync_care] 주소 없는 보건기관 제외 - ${raw.htInstNm}`);
      continue; // eslint-disable-line no-continue
    }
    // eslint-disable-next-line no-await-in-loop
    const coord = await geocodeAddress(address);
    if (!coord || !isValidKoreaCoord(coord.lat, coord.lng)) {
      console.warn(`[sync_care] 지오코딩 실패/좌표 범위 밖 제외 - ${raw.htInstNm} (${address})`);
      continue; // eslint-disable-line no-continue
    }

    const nameKo = raw.htInstNm;
    // eslint-disable-next-line no-await-in-loop
    const { en: nameEn, zh: nameZh } = await translateName(nameKo, 'care');
    const contentId = `care-health-${raw.insttCode || 'unknown'}-${stableHash(`${nameKo}|${address}`)}`;

    rows.push({
      content_id: contentId,
      region_code: regionCode,
      name_ko: nameKo,
      name_en: nameEn,
      name_zh: nameZh,
      category: healthCategoryFor(raw.htctTypeNm),
      phone: raw.telno || null,
      address_ko: address,
      lat: coord.lat,
      lng: coord.lng,
      synced_at: syncStartedAt,
    });
    console.log(`[sync_care] 보건기관 ${nameKo} (${regionCode}, ${raw.htctTypeNm}) 지오코딩+번역 완료`);
  }
  return rows;
}

async function main() {
  const syncStartedAt = new Date().toISOString();
  let rows = [];
  try {
    const [emergencyRows, healthRows] = await Promise.all([
      buildEmergencyRows(syncStartedAt),
      buildHealthInstitutionRows(syncStartedAt),
    ]);
    rows = [...emergencyRows, ...healthRows];
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

  // 지역별로 이번 실행보다 오래된 로우 정리 (sync_pois.js와 동일 패턴) — 시드(content_id가
  // 'seed-'로 시작)도 synced_at이 더 예전이라 자동으로 함께 정리된다.
  const regionCodes = [...new Set(rows.map((r) => r.region_code))];
  const { error: cleanupErr } = await supabase.from('care_facilities').delete().in('region_code', regionCodes).lt('synced_at', syncStartedAt);
  if (cleanupErr) {
    console.error('[sync_care] 정리 실패:', cleanupErr.message);
    return;
  }

  console.log(`[sync_care] 총 ${rows.length}건 동기화 완료 (${regionCodes.join(', ')})`);
}

main();
