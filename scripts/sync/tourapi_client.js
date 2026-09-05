// 한국관광공사 TourAPI 클라이언트 (PRD 5장 — 배치 동기화 전용, 실시간 호출 금지).
//
// 주의: TourAPI는 공공데이터포털 개편에 따라 엔드포인트 버전(KorService1/2 등)이 바뀐 이력이 있다.
// 이 파일은 TOURAPI_BASE_URL을 env로 오버라이드 가능하게 해뒀으니, 실제 서비스키 발급 후
// 공공데이터포털 문서의 최신 base URL로 맞춰 확인할 것 (실제 네트워크 호출은 서비스키가 없어
// 이 세션에서 검증하지 못했음 — docs/HANDOFF_LOG.md 블로커 참고).
require('dotenv').config();

const BASE_URL = process.env.TOURAPI_BASE_URL || 'https://apis.data.go.kr/B551011/KorService2';
const SERVICE_KEY = process.env.TOURAPI_SERVICE_KEY;

// 강원도(areaCode=32) 시군 코드. sigunguCode는 areaCode2 API로 조회 가능한 값이며,
// 아래는 공개 자료 기준 추정치 — 실제 서비스키로 sigunguCode2 호출해 한 번 검증 필요(HANDOFF_LOG 참고).
const REGION_TO_SIGUNGU = {
  injae: { areaCode: 32, sigunguCode: 5 },
  hongcheon: { areaCode: 32, sigunguCode: 3 },
  pyeongchang: { areaCode: 32, sigunguCode: 7 },
};

async function callTourApi(endpoint, params) {
  if (!SERVICE_KEY) {
    throw new Error('TOURAPI_SERVICE_KEY가 설정되지 않았습니다 (.env 확인). 공공데이터포털에서 발급받아야 합니다.');
  }
  const query = new URLSearchParams({
    serviceKey: SERVICE_KEY,
    MobileOS: 'ETC',
    MobileApp: 'GangwonGo',
    _type: 'json',
    numOfRows: '100',
    ...params,
  });
  const url = `${BASE_URL}/${endpoint}?${query.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TourAPI 호출 실패: ${endpoint} HTTP ${res.status}`);
  }
  const json = await res.json();
  const items = json?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

/**
 * 지역 기반 관광정보 조회 (areaBasedList2) — contentTypeId를 지정하지 않으면 전체 타입 조회.
 */
async function fetchAreaBasedList(regionCode, { contentTypeId } = {}) {
  const region = REGION_TO_SIGUNGU[regionCode];
  if (!region) throw new Error(`알 수 없는 region_code: ${regionCode}`);
  const params = { areaCode: region.areaCode, sigunguCode: region.sigunguCode };
  if (contentTypeId) params.contentTypeId = contentTypeId;
  return callTourApi('areaBasedList2', params);
}

/**
 * 축제/공연/행사(contentTypeId=15) 상세에서 event_start_date/end_date 확보 (detailIntro2).
 */
async function fetchFestivalDates(contentId, contentTypeId) {
  const items = await callTourApi('detailIntro2', { contentId, contentTypeId });
  const detail = items[0];
  if (!detail) return { eventStartDate: null, eventEndDate: null };
  return {
    eventStartDate: detail.eventstartdate ? formatDate(detail.eventstartdate) : null,
    eventEndDate: detail.eventenddate ? formatDate(detail.eventenddate) : null,
  };
}

function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return null;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

module.exports = { fetchAreaBasedList, fetchFestivalDates, REGION_TO_SIGUNGU };
