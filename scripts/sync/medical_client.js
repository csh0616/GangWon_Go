// 의료관광정보 서비스(MdclTursmService) 클라이언트 — 공식 매뉴얼 v4.1 기준으로 확정된 스펙 그대로
// 구현 (docs/HANDOFF_LOG.md 2026-09-07 00:30 항목, "추측 금지"). TourAPI(KorService2)와 반대로
// 응답 필드가 camelCase(contentId, mapX, mapY 등)다 — 두 스크립트를 같은 케이싱 규칙으로 통일하면
// 안 된다(라운드1에서 고친 케이싱 버그와 같은 함정이 반대 방향으로 있음).
require('dotenv').config();

const BASE_URL = 'https://apis.data.go.kr/B551011/MdclTursmService';
const SERVICE_KEY = process.env.MEDICAL_TOURISM_SERVICE_KEY;

// /ldongCode는 API가 자체 부여한 코드라 수식으로 유도하거나 추측할 수 없다(기상청 격자와 다른 점 —
// 그쪽은 공개된 변환 공식이 있어 kmaGrid.js로 계산했지만, 이건 그런 공식이 없는 순수 조회 전용
// 코드다). ldong_lookup.js를 실제 서비스키로 1회 실행해서 나온 값을 여기 채워넣을 것.
const REGION_TO_LDONG = {
  injae: { lDongRegnCd: null, lDongSignguCd: null },
  hongcheon: { lDongRegnCd: null, lDongSignguCd: null },
  pyeongchang: { lDongRegnCd: null, lDongSignguCd: null },
};

async function callMedicalApi(endpoint, params) {
  if (!SERVICE_KEY) {
    throw new Error('MEDICAL_TOURISM_SERVICE_KEY가 설정되지 않았습니다 (.env 확인).');
  }
  const query = new URLSearchParams({
    serviceKey: SERVICE_KEY,
    MobileOS: 'ETC',
    MobileApp: 'GangwonGo',
    numOfRows: '100',
    pageNo: '1',
    _type: 'json',
    ...params,
  });
  const res = await fetch(`${BASE_URL}/${endpoint}?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`의료관광정보 API 호출 실패: ${endpoint} HTTP ${res.status}`);
  }
  const json = await res.json();
  const items = json?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

/**
 * 시군 + 언어(ENG/CHS)로 시설 목록 조회. 목록 응답에 tel/mapX/mapY/title/baseAddr가 이미 포함되어
 * detailCommon 호출이 필요 없다 (공식 매뉴얼 확인 완료 — PM 확정, HANDOFF_LOG 참고).
 * @param {string} regionCode
 * @param {'ENG'|'CHS'} langDivCd
 */
async function fetchAreaBasedList(regionCode, langDivCd) {
  const region = REGION_TO_LDONG[regionCode];
  if (!region) throw new Error(`알 수 없는 region_code: ${regionCode}`);
  if (!region.lDongRegnCd || !region.lDongSignguCd) {
    throw new Error(
      `${regionCode}의 lDongRegnCd/lDongSignguCd가 설정되지 않았습니다 — node ldong_lookup.js를 먼저 실행해 medical_client.js의 REGION_TO_LDONG을 채울 것.`
    );
  }
  return callMedicalApi('areaBasedList', {
    langDivCd,
    arrange: 'C',
    lDongRegnCd: region.lDongRegnCd,
    lDongSignguCd: region.lDongSignguCd,
  });
}

module.exports = { callMedicalApi, fetchAreaBasedList, REGION_TO_LDONG };
