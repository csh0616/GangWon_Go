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

/**
 * sessionStorage 값을 검증 없이 그대로 신뢰하면, 과거에 저장된 깨진 응답이 새로고침마다
 * 재생되어 빠져나올 수 없는 크래시 루프를 만든다(P0-B, 실제로 발생했다 — HANDOFF_LOG 배포본
 * 1차 점검). days 배열과 각 day의 stops 배열이 있는지만 최소로 확인하고, 어긋나면 저장소를
 * 비우고 null을 반환해 /result가 pending_request부터 다시 생성하도록 한다.
 */
function isValidGuestItinerary(value: unknown): value is GuestItinerary {
  if (!value || typeof value !== "object") return false;
  const days = (value as { response?: { itinerary_json?: { days?: unknown } } }).response?.itinerary_json?.days;
  if (!Array.isArray(days)) return false;
  return days.every(
    (d) => d && typeof d === "object" && Array.isArray((d as { stops?: unknown }).stops)
  );
}

export function loadGuestItinerary(): GuestItinerary | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(GUEST_ITINERARY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidGuestItinerary(parsed)) {
      clearGuestItinerary();
      return null;
    }
    return parsed;
  } catch {
    clearGuestItinerary();
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

/**
 * 저장 버튼 → 구글 로그인은 실제 OAuth에서는 전체 페이지 리다이렉트다(P0-C) — 로그인을
 * 누른 순간의 React 상태(SaveFlowModal이 열려 있던 것)는 리다이렉트로 돌아왔을 때 이미
 * 사라진 뒤다. "로그인하러 가기 직전에 저장을 이어서 하려 했다"는 사실만 sessionStorage에
 * 남겨두고, 돌아온 페이지가 이 값을 보고 저장을 자동으로 재개한다
 * (components/save/SaveFlowModal.tsx의 resumeMode, app/[locale]/result/page.tsx 참고).
 */
const PENDING_SAVE_KEY = "ggo:pending_save";

export function markPendingSave() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_SAVE_KEY, "1");
  } catch {
    // no-op
  }
}

export function consumePendingSave(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const had = window.sessionStorage.getItem(PENDING_SAVE_KEY) === "1";
    window.sessionStorage.removeItem(PENDING_SAVE_KEY);
    return had;
  } catch {
    return false;
  }
}
