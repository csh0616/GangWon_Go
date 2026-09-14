// 여행 케어 안내 데이터 소스 (PRD 5장/8장) — MdclTursmService(의료관광 인증 시설)는 인제/홍천/
// 평창 전부 0건이라 폐기, 전국보건기관표준데이터는 강원이 데이터셋에 통째로 없어 라운드6에서
// 폐기(PRD 5장). 셋 다 공공데이터포털 공유 서비스키를 그대로 쓴다(TOURAPI_SERVICE_KEY와 동일
// 계정 키, 라운드3에서 확인된 관례).
require('dotenv').config();

const SERVICE_KEY = process.env.TOURAPI_SERVICE_KEY;

const EMERGENCY_BASE_URL = 'https://apis.data.go.kr/B552657/ErmctInfoInqireService';
const HOSPITAL_BASE_URL = 'https://apis.data.go.kr/B552657/HsptlAsembySearchService';

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
 * 국립중앙의료원 전국 병·의원 찾기 서비스(라운드6 【2】, PRD 8장) — 응급의료기관만으로는 시군당
 * 0~1건이라 추가. `getHsptlMdcncListInfoInqire`가 정확한 오퍼레이션(실측 확인). ErmctInfoInqireService와
 * 달리 **`Q0`(시도)/`Q1`(시군구) 파라미터가 실제로 동작한다**(실측: 무필터 totalCount=78,954 →
 * Q0=강원특별자치도+Q1=인제군 totalCount=29) — 그래서 시군별로 직접 필터링해서 받는다(전량을
 * 받을 필요 없음, 응급의료기관/보건기관표준데이터와는 다른 패턴).
 */
async function fetchHospitalsAndClinics(sggName) {
  if (!SERVICE_KEY) throw new Error('TOURAPI_SERVICE_KEY가 설정되지 않았습니다 (.env 확인).');
  const all = [];
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
    const query = new URLSearchParams({
      pageNo: String(pageNo),
      numOfRows: String(PAGE_SIZE),
      _type: 'json',
      Q0: '강원특별자치도',
      Q1: sggName,
    });
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(`${HOSPITAL_BASE_URL}/getHsptlMdcncListInfoInqire?serviceKey=${SERVICE_KEY}&${query.toString()}`);
    if (!res.ok) throw new Error(`병·의원 찾기 API 호출 실패: HTTP ${res.status}`);
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

module.exports = { fetchAllEmergencyFacilities, fetchHospitalsAndClinics };
