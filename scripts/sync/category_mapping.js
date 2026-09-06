// TourAPI 원본 카테고리 → PRD 3.5절 7개 카테고리 마스터 키 매핑 규칙.
//
// PRD/API_CONTRACT.md 둘 다 "세부 매핑은 백엔드팀이 /scripts/sync 구현 시 확정"이라고 위임했으므로
// 여기서 확정한다 (docs/HANDOFF_LOG.md에도 근거를 기록). TourAPI(Tour API 4.0)의 공개된 분류 체계는
// contentTypeId(콘텐츠 타입)와 cat1/cat2(대/중분류) 두 축으로 이뤄져 있고, 이 매핑은 두 축을 함께 본다
// — 하나만 보면 애매한 경우(예: 문화시설 콘텐츠 타입이지만 cat1이 자연인 항목)가 있기 때문.
//
// **적용 우선순위**: contentTypeId 기반 규칙을 먼저 확인하고, 없으면 cat1/cat2 기반 규칙을 확인한다.
// 어느 것도 매칭되지 않으면 null을 반환하고, 호출부(sync_pois.js)는 그 POI를 동기화 대상에서 제외한다
// (숙박/여행코스처럼 7개 카테고리 밖의 콘텐츠 타입은 PRD 2.3절 스코프 밖이라 애초에 pois에 넣지 않는다).

// contentTypeId (TourAPI 콘텐츠 타입) 기준 — 가장 신뢰도 높은 신호
const CONTENT_TYPE_MAP = {
  15: 'festival_event', // 축제공연행사
  28: 'leisure_sports', // 레포츠
  38: 'shopping', // 쇼핑
  39: 'food_local', // 음식점
  14: 'culture_history', // 문화시설
};

// cat1(대분류)/cat2(중분류) 기준 — contentTypeId만으로 판단 안 될 때 (특히 관광지=12 콘텐츠 타입)
const CAT2_MAP = {
  A0202: 'onsen_wellness', // 휴양관광지 (온천/스파/자연휴양림 등)
  A0201: 'culture_history', // 역사관광지
  A0203: 'culture_history', // 체험관광지
  A0204: 'culture_history', // 산업관광지
  A0205: 'culture_history', // 건축/조형물
  A0206: 'culture_history', // 문화시설
  A0207: 'festival_event', // 축제
  A0208: 'festival_event', // 공연/행사
};

const CAT1_MAP = {
  A01: 'nature_hiking', // 자연 (등산/경관 포함 — 별도 photo_scenic 카테고리를 두지 않기로 함, PRD 3.5절)
  A03: 'leisure_sports', // 레포츠
  A04: 'shopping', // 쇼핑
  A05: 'food_local', // 음식
};

/**
 * @param {object} raw - TourAPI 원본 항목 (areaBasedList2 등 응답의 1개 row)
 * @param {string|number} raw.contenttypeid - TourAPI `_type=json` 응답은 키가 전부 소문자다
 *   (1주차 아키텍처 점검 #9 — `contentTypeId`로 읽었더니 항상 undefined라 CONTENT_TYPE_MAP 전체가
 *   dead code였음. cat1/cat2는 원래부터 소문자라 영향 없었음)
 * @param {string} [raw.cat1]
 * @param {string} [raw.cat2]
 * @returns {string|null} 7개 마스터 키 중 하나, 매칭 안 되면 null (동기화 대상 제외)
 */
function mapTourApiCategory(raw) {
  const contentTypeId = String(raw.contenttypeid || '');
  if (CONTENT_TYPE_MAP[contentTypeId]) return CONTENT_TYPE_MAP[contentTypeId];

  if (raw.cat2 && CAT2_MAP[raw.cat2]) return CAT2_MAP[raw.cat2];
  if (raw.cat1 && CAT1_MAP[raw.cat1]) return CAT1_MAP[raw.cat1];

  return null;
}

module.exports = { mapTourApiCategory, CONTENT_TYPE_MAP, CAT2_MAP, CAT1_MAP };
