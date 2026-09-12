import type { SavedItineraryDetail } from "../types";

/**
 * 이번 브라우저 세션에서 새로 저장한 코스 저장소 (실제로는 DB가 할 일). 모듈 전역 변수로만 들면
 * 새로고침 한 번에 사라져 "저장된 코스는 /itinerary/:id 주소를 가져야 뒤로가기·새로고침이 산다"는
 * 요구사항을 못 지키므로, sessionStorage에 함께 반영한다.
 */
export type SessionSavedRecord = SavedItineraryDetail & { created_at: string };

const KEY = "ggo:saved_itineraries";

function readAll(): Record<string, SessionSavedRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, SessionSavedRecord>) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, SessionSavedRecord>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // no-op — 베스트 에포트 영속화
  }
}

export function getSessionSaved(id: string): SessionSavedRecord | undefined {
  return readAll()[id];
}

export function listSessionSaved(): SessionSavedRecord[] {
  return Object.values(readAll());
}

export function putSessionSaved(record: SessionSavedRecord) {
  const all = readAll();
  all[record.id] = record;
  writeAll(all);
}
