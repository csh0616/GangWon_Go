// 여행 케어 안내 데이터 소스 2종 (라운드5 【2】, PRD 5장/8장) — MdclTursmService(의료관광 인증
// 시설)는 인제/홍천/평창 전부 0건이라 아래 두 개로 교체했다. 둘 다 공공데이터포털 공유 서비스키를
// 그대로 쓴다(TOURAPI_SERVICE_KEY와 동일 계정 키, 라운드3에서 확인된 관례).
require('dotenv').config();

const SERVICE_KEY = process.env.TOURAPI_SERVICE_KEY;

const EMERGENCY_BASE_URL = 'https://apis.data.go.kr/B552657/ErmctInfoInqireService';
const HEALTH_INST_BASE_URL = 'https://api.data.go.kr/openapi/tn_pubr_public_ht_inst_api';

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

/**
 * 국립중앙의료원 전국 응급의료기관 조회 서비스 — 실측 확인된 정확한 오퍼레이션은
 * `getEgytBassInfoInqire`다(기초정보, 실좌표 포함). `getEgytLcinfoInqire`는 이 계정 조합에서
 * 항상 0건이라 폐기 — STAGE1/STAGE2 지역 필터 파라미터가 이 오퍼레이션에는 적용되지 않는 것으로
 * 실측 확인(전국 529건이 필터 값과 무관하게 그대로 반환됨), 그래서 전량을 받아 주소 문자열로
 * 필터한다(전국문화축제표준데이터와 동일 패턴).
 */
async function fetchAllEmergencyFacilities() {
  if (!SERVICE_KEY) throw new Error('TOURAPI_SERVICE_KEY가 설정되지 않았습니다 (.env 확인).');
  const all = [];
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
    const query = new URLSearchParams({ pageNo: String(pageNo), numOfRows: String(PAGE_SIZE), _type: 'json' });
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(`${EMERGENCY_BASE_URL}/getEgytBassInfoInqire?serviceKey=${SERVICE_KEY}&${query.toString()}`);
    if (!res.ok) throw new Error(`응급의료기관 API 호출 실패: HTTP ${res.status}`);
    // eslint-disable-next-line no-await-in-loop
    const json = await res.json();
    const body = json?.response?.body;
    const items = body?.items?.item;
    const list = items ? (Array.isArray(items) ? items : [items]) : [];
    all.push(...list);
    if (list.length === 0 || all.length >= Number(body?.totalCount || 0)) break;
  }
  return all;
}

/**
 * 전국보건기관표준데이터 — sync_festivals.js와 동일 패턴(type=json, body.items.item[]).
 * `sggNm`(시군구명) 필드로 정확히 필터 가능 — 주소 문자열 부분일치보다 안전하다.
 * 좌표 필드가 없어(주소만 제공) 호출부(sync_care.js)가 Kakao 로컬 API로 지오코딩한다.
 */
async function fetchAllHealthInstitutions() {
  if (!SERVICE_KEY) throw new Error('TOURAPI_SERVICE_KEY가 설정되지 않았습니다 (.env 확인).');
  const all = [];
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
    const query = new URLSearchParams({ pageNo: String(pageNo), numOfRows: String(PAGE_SIZE), type: 'json' });
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(`${HEALTH_INST_BASE_URL}?serviceKey=${SERVICE_KEY}&${query.toString()}`);
    if (!res.ok) throw new Error(`전국보건기관표준데이터 API 호출 실패: HTTP ${res.status}`);
    // eslint-disable-next-line no-await-in-loop
    const json = await res.json();
    const body = json?.body;
    const items = body?.items?.item;
    const list = items ? (Array.isArray(items) ? items : [items]) : [];
    all.push(...list);
    if (list.length === 0 || all.length >= Number(body?.totalCount || 0)) break;
  }
  return all;
}

module.exports = { fetchAllEmergencyFacilities, fetchAllHealthInstitutions };
