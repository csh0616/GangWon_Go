import type { GenerateRequest, GenerateResponseData, Relationship } from "./types";

/**
 * 게스트 코스 보존 (PRD 6장 "프론트가 반드시 처리해야 할 상태"):
 * 게스트 코스는 서버에 row가 없어 클라이언트 상태로만 존재한다. 메모리에만 두면 새로고침 한 번에
 * 사라지므로 sessionStorage에 보관해 새로고침·뒤로가기를 견디게 한다. 탭을 닫으면 사라지는 건
 * 의도된 동작(게스트 세션은 로그인 전까지 영속시키지 않음, PRD 3.9절).
 */
const GUEST_ITINERARY_KEY = "ggo:guest_itinerary";

export type GuestItinerary = {
  request: GenerateRequest;
  response: GenerateResponseData;
};

export function saveGuestItinerary(value: GuestItinerary) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(GUEST_ITINERARY_KEY, JSON.stringify(value));
  } catch {
    // sessionStorage 접근 불가(프라이빗 모드 등) — 게스트 보존은 베스트 에포트이므로 조용히 무시
  }
}

export function loadGuestItinerary(): GuestItinerary | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(GUEST_ITINERARY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuestItinerary;
  } catch {
    return null;
  }
}

export function clearGuestItinerary() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(GUEST_ITINERARY_KEY);
  } catch {
    // no-op
  }
}

/**
 * 부분 재구성(코스 부분 수정)은 저장된 일정에서만 지원된다(API_CONTRACT.md §3) — 게스트 상태에서는
 * `companions`/`relationship`을 서버가 갖고 있지 않으므로, 저장 전까지는 클라이언트가 원본 입력을
 * 들고 있어야 한다는 PRD 3.5절 3번 각주와 동일한 이유로 guest_itinerary.request에 함께 보관한다.
 */
export function guestRelationship(): Relationship | null {
  return loadGuestItinerary()?.request.relationship ?? null;
}

/**
 * Main 화면에서 제출한 요청을 /result 화면이 읽어 생성을 시작하도록 잠깐 들고 있는 자리.
 * 새로고침 시 재생성되지 않도록(중복 호출 방지) 읽는 즉시 지우지 않고, 결과가 생기면
 * guest_itinerary로 옮겨 쓴다.
 */
const PENDING_REQUEST_KEY = "ggo:pending_request";

export function savePendingRequest(request: GenerateRequest) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_REQUEST_KEY, JSON.stringify(request));
  } catch {
    // no-op
  }
}

export function loadPendingRequest(): GenerateRequest | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_REQUEST_KEY);
    return raw ? (JSON.parse(raw) as GenerateRequest) : null;
  } catch {
    return null;
  }
}

export function clearPendingRequest() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_REQUEST_KEY);
  } catch {
    // no-op
  }
}

/**
 * 방금 저장을 마치고 /itinerary/:id로 넘어온 경우에만 SavedToast + NotifyPermission을 띄우기 위한
 * 1회성 표시. 새로고침 시에는 다시 뜨지 않아야 하므로 읽는 즉시 지운다.
 */
const JUST_SAVED_KEY = "ggo:just_saved_id";

export function markJustSaved(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(JUST_SAVED_KEY, id);
  } catch {
    // no-op
  }
}

export function consumeJustSaved(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(JUST_SAVED_KEY);
    if (raw === id) {
      window.sessionStorage.removeItem(JUST_SAVED_KEY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
