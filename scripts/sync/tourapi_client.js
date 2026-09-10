// 한국관광공사 TourAPI 클라이언트 (PRD 5장 — 배치 동기화 전용, 실시간 호출 금지).
//
// 주의: TourAPI는 공공데이터포털 개편에 따라 엔드포인트 버전(KorService1/2 등)이 바뀐 이력이 있다.
// 이 파일은 TOURAPI_BASE_URL을 env로 오버라이드 가능하게 해뒀으니, 실제 서비스키 발급 후
// 공공데이터포털 문서의 최신 base URL로 맞춰 확인할 것.
//
// serviceKey 이중 인코딩 주의 (라운드3 P0, 실측으로 확인된 유일한 해법): 공공데이터포털이 발급하는
// 키는 이미 URL-encode된 "Encoding" 키다. URLSearchParams에 넣으면 그걸 또 한 번 인코딩해서
// (`%2B` → `%252B`) HTTP 403 SERVICE_KEY_IS_NOT_REGISTERED_ERROR가 난다 — serviceKey는
// URLSearchParams 밖으로 빼서 URL 문자열에 그대로 붙여야 한다(나머지 파라미터는 그대로 인코딩).
require('dotenv').config();

const BASE_URL = process.env.TOURAPI_BASE_URL || 'https://apis.data.go.kr/B551011/KorService2';
const SERVICE_KEY = process.env.TOURAPI_SERVICE_KEY;

// 강원도(areaCode=32) 시군 코드 — `areaCode2?areaCode=32`를 실제 서비스키로 호출해 확정한 값
// (라운드3, 이전 추정치는 전부 틀렸었음 — 인제=5는 실제로 속초시, 홍천=3은 동해시, 평창=7은
// 양양군 데이터였다. "평창" 89건 전부에 대관령/진부/봉평/월정사 등 평창 지명이 단 하나도 없고
// 양양송이축제/낙산사/남애항처럼 양양 지명만 나오는 것으로 실측 확인). 아래는
// areaCode2 응답 전체(18개 시군) 중 3곳만 — 나머지는 스코프 밖이라 생략.
const REGION_TO_SIGUNGU = {
  injae: { areaCode: 32, sigunguCode: 10 },
  hongcheon: { areaCode: 32, sigunguCode: 16 },
  pyeongchang: { areaCode: 32, sigunguCode: 15 },
};

async function callTourApi(endpoint, params) {
  if (!SERVICE_KEY) {
    throw new Error('TOURAPI_SERVICE_KEY가 설정되지 않았습니다 (.env 확인). 공공데이터포털에서 발급받아야 합니다.');
  }
  const query = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'GangwonGo',
    _type: 'json',
    numOfRows: '100',
    ...params,
  });
  // serviceKey는 이미 인코딩된 키라 URLSearchParams를 거치지 않고 그대로 붙인다 (위 헤더 참고)
  const url = `${BASE_URL}/${endpoint}?serviceKey=${SERVICE_KEY}&${query.toString()}`;
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
