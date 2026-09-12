/**
 * Supabase Auth(Google 로그인) 목업 (PRD 3.9절). 실제 OAuth 팝업 대신 지연 후 성공/실패를 흉내낸다.
 *
 * 재시도 흐름을 자연스럽게 시연할 수 있도록, **세션당 첫 로그인 시도는 항상 실패**하고 그 다음
 * 시도부터는 성공한다 (LoginRetry 화면을 매번 결정론적으로 볼 수 있게). "다시 시도" 버튼이 자동
 * 재시도가 아니라 사용자 클릭으로만 팝업을 다시 여는 이유는 PRD 3.9절 참고 — 브라우저 팝업 차단 회피.
 */

const AUTH_KEY = "ggo:auth";
const ATTEMPT_KEY = "ggo:login_attempts";

export type Session = { user_id: string; token: string };

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function setSession(session: Session) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function logout() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(AUTH_KEY);
}

export async function mockGoogleLogin(): Promise<{ ok: true; session: Session } | { ok: false }> {
  await delay(700);

  let attempts = 0;
  try {
    attempts = Number(window.sessionStorage.getItem(ATTEMPT_KEY) ?? "0");
  } catch {
    // ignore
  }
  attempts += 1;
  try {
    window.sessionStorage.setItem(ATTEMPT_KEY, String(attempts));
  } catch {
    // ignore
  }

  if (attempts === 1) {
    return { ok: false };
  }

  const session: Session = { user_id: "usr_demo_001", token: "mock-token" };
  setSession(session);
  return { ok: true, session };
}
