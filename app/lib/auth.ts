import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * 실제 Supabase Auth 구현 (P0-C) — app/lib/mock/auth.ts의 공개 인터페이스(getSession /
 * mockGoogleLogin / logout / subscribeAuthChange)를 그대로 유지해 이를 import하던 5개 파일
 * (mypage/page.tsx, components/layout/{Header,GuestLoginHint,LoginModal}.tsx,
 * components/save/SaveFlowModal.tsx)의 호출부 변경을 import 경로 한 줄로만 최소화했다.
 * mock/auth.ts는 삭제했다.
 */

const AUTH_CHANGE_EVENT = "ggo:auth-changed";

// user_id에 "@gmail.com"을 붙여 지어낸 이메일을 보여주던 버그(외부 검수 리포트 23)의 수정
// 대상 — 실제 Supabase 세션의 user.email을 담는다. 이메일이 없으면(드묾) null.
export type Session = { user_id: string; token: string; email: string | null };

// getSession()이 동기 함수라는 기존 인터페이스를 유지하기 위한 캐시 — Supabase의 실제
// getSession()은 비동기라, 모듈 로드 시 한 번 채우고 onAuthStateChange로 계속 갱신한다.
// 이미 이 패턴을 쓰던 기존 호출부(Header/GuestLoginHint가 subscribeAuthChange로 재조회,
// mypage가 "checking" 상태로 하이드레이션 지연을 흡수)가 그대로 맞아떨어진다.
let cachedSession: Session | null = null;
// 모듈이 로드된 뒤 Supabase의 최초 getSession()/onAuthStateChange 응답을 한 번이라도
// 받았는지 — 리다이렉트 직후엔 이게 false인 동안 cachedSession이 null이어도 "로그아웃
// 상태"가 아니라 "아직 확인 중"이다. useAuthSession 훅이 이 구분을 쓴다.
let ready = false;

function toSession(session: SupabaseSession | null): Session | null {
  if (!session) return null;
  return { user_id: session.user.id, token: session.access_token, email: session.user.email ?? null };
}

function emitAuthChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

if (typeof window !== "undefined") {
  supabase.auth.getSession().then(({ data }) => {
    cachedSession = toSession(data.session);
    ready = true;
    emitAuthChange();
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedSession = toSession(session);
    ready = true;
    emitAuthChange();
  });
}

export function getSession(): Session | null {
  return cachedSession;
}

/**
 * 아직 Supabase로부터 한 번도 응답을 못 받은 상태(모듈이 막 로드됐거나, 리다이렉트 직후
 * onAuthStateChange가 아직 도착하지 않은 순간)인지. false를 "로그아웃"으로 오인하면 안 되는
 * 곳(마이페이지 초기 화면 등)에서 쓴다.
 */
export function isAuthReady(): boolean {
  return ready;
}

export function logout() {
  // 캐시를 먼저 비우고 이벤트를 쏴서 Header/GuestLoginHint가 실제 signOut 왕복을 기다리지 않고
  // 즉시 게스트 화면으로 돌아가게 한다 — mypage.tsx의 handleLogout도 이미 같은 낙관적 갱신
  // 패턴(logout() 직후 setSession(null))을 쓰고 있어 그대로 맞는다.
  cachedSession = null;
  emitAuthChange();
  void supabase.auth.signOut();
}

/**
 * 로그인/로그아웃이 다른 컴포넌트(GuestLoginHint, Header 등)에서 일어나도 전역 상태 관리 없이
 * 즉시 반영되도록 하는 최소한의 구독.
 */
export function subscribeAuthChange(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_CHANGE_EVENT, callback);
  return () => window.removeEventListener(AUTH_CHANGE_EVENT, callback);
}

function currentUrl(): string | undefined {
  return typeof window !== "undefined" ? window.location.href : undefined;
}

/**
 * 함수 이름은 목업 시절 그대로다(위 설명 참고). 실제로는 Supabase Google OAuth를 시작한다.
 *
 * 목업과 결정적으로 다른 점: signInWithOAuth는 브라우저를 Google 동의 화면으로 **리다이렉트**
 * 시킬 뿐이고(팝업이 아니다), 실제 세션은 사용자가 동의를 마치고 redirectTo로 돌아온 뒤에야
 * 생긴다. 즉 이 함수가 `{ ok: true }`로 끝나는 경우는 사실상 없다 — 그 전에 페이지가 이동한다.
 * `{ ok: false }`는 리다이렉트 자체를 시작하지 못했을 때(Supabase 설정 오류·네트워크 문제)만
 * 온다. 로그인 이후 이어서 할 일(코스 저장 재개 등)은 돌아온 뒤 이 세션을 다시 읽어 처리해야
 * 한다 — components/save/SaveFlowModal.tsx의 resumeMode, app/lib/storage.ts의
 * markPendingSave/consumePendingSave가 그 역할이다.
 *
 * `redirectTo`는 클릭 시점의 현재 URL을 그대로 쓴다 — /ko, /en, /zh 로케일이 경로에 포함돼
 * 있으므로 별도 처리 없이 로케일이 유지된 채 같은 화면으로 돌아온다.
 */
export async function mockGoogleLogin(): Promise<{ ok: true; session: Session } | { ok: false }> {
  if (!isSupabaseConfigured) return { ok: false };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: currentUrl() },
  });
  if (error) return { ok: false };
  const session = getSession();
  return session ? { ok: true, session } : { ok: false };
}
