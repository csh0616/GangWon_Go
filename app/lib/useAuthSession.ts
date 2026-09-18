"use client";

import { useCallback, useEffect, useState } from "react";
import { getSession, isAuthReady, subscribeAuthChange, type Session } from "./auth";

export type AuthSessionState = {
  session: Session | null;
  /** false면 "확인 중"이다 — session이 null이어도 아직 로그아웃 상태로 단정하면 안 된다. */
  ready: boolean;
};

/**
 * 인증 상태를 읽는 공통 훅 — Header, GuestLoginHint, mypage, SaveFlowModal, LoginModal이
 * 전부 이것만 쓴다. getSession()을 한 번만 확인하고 끝내면 리다이렉트 직후 아직 도착하지
 * 않은 세션을 영영 반영하지 못하는 버그가 여러 컴포넌트에 따로 나기 때문에(외부 검수 리포트
 * 02/11/12/27), 구독 로직을 한 곳으로 모았다.
 */
export function useAuthSession(): AuthSessionState {
  // 항상 {session:null, ready:false}로 시작한다 — getSession()/isAuthReady()를 초기값으로
  // 바로 읽으면, 클라이언트에서 Supabase의 비동기 getSession()이 서버 렌더보다 먼저(빠른
  // 마이크로태스크 타이밍으로) 끝나버려 SSR 결과와 첫 클라이언트 렌더가 달라지는 하이드레이션
  // 오류가 났다(실측). 서버는 이 값을 절대 미리 알 수 없으므로, 실제 값은 마운트 후
  // useEffect에서만 반영한다.
  const [state, setState] = useState<AuthSessionState>({ session: null, ready: false });

  const refresh = useCallback(() => {
    setState({ session: getSession(), ready: isAuthReady() });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    return subscribeAuthChange(refresh);
  }, [refresh]);

  return state;
}
