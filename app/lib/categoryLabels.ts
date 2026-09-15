import type { CategoryKey } from "./types";

/**
 * 서버가 마스터 키 7개만 내보낸다고 계약에 적혀 있어도(API_CONTRACT.md §1 상자), 그 보장이
 * 깨진 응답 한 번이 화면 전체를 죽인 전례가 있다(배포본 실연동 1차 점검, categories.A01010900
 * MISSING_MESSAGE → React 렌더 트리 붕괴). 타입이 CategoryKey라고 주장해도 런타임 값은 그 보장이
 * 없으므로, 라벨을 그리기 전에 항상 이 목록으로 한 번 더 검증한다.
 */
export const CATEGORY_KEYS: readonly CategoryKey[] = [
  "nature_hiking",
  "onsen_wellness",
  "culture_history",
  "food_local",
  "festival_event",
  "shopping",
  "leisure_sports",
];

export function isKnownCategory(value: string): value is CategoryKey {
  return (CATEGORY_KEYS as readonly string[]).includes(value);
}

/** API_CONTRACT.md §4 — health_subcenter는 키만 유지, 당분간 값이 들어오지 않는다. */
export const CARE_CATEGORY_KEYS = [
  "emergency_room",
  "health_center",
  "health_subcenter",
  "hospital",
  "clinic",
] as const;

export type CareCategoryKey = (typeof CARE_CATEGORY_KEYS)[number];

export function isKnownCareCategory(value: string): value is CareCategoryKey {
  return (CARE_CATEGORY_KEYS as readonly string[]).includes(value);
}
