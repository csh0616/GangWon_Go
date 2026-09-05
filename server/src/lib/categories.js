// PRD 3.5절 — 카테고리 마스터 목록 (확정, 브레이킹 체인지로 취급할 것).
// pois.tags[]와 LLM weights 출력이 반드시 이 7개 키만 사용해야 한다.
const CATEGORY_KEYS = [
  'nature_hiking',
  'onsen_wellness',
  'culture_history',
  'food_local',
  'festival_event',
  'shopping',
  'leisure_sports',
];

// PRD 3.5절 — relationship enum (초안)
const RELATIONSHIP_ENUM = ['couple', 'family_with_kids', 'friends', 'solo', 'group'];

// PRD 3.5절 — activity_level별 하루 스탑 개수 범위 (min, max)
const ACTIVITY_STOP_RANGE = {
  low: [2, 3],
  medium: [3, 4],
  high: [4, 5],
};

const REGION_CODES = ['injae', 'hongcheon', 'pyeongchang'];

function isValidCategoryKey(key) {
  return CATEGORY_KEYS.includes(key);
}

function emptyWeights() {
  return CATEGORY_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
}

module.exports = {
  CATEGORY_KEYS,
  RELATIONSHIP_ENUM,
  ACTIVITY_STOP_RANGE,
  REGION_CODES,
  isValidCategoryKey,
  emptyWeights,
};
