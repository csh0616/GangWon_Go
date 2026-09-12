"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AlertPayload } from "@/app/lib/types";
import { subscribeAlerts } from "@/app/lib/api";

/**
 * 매니징 알림 전역 상태 (PRD 6장 "코스 화면 밖에서 도착하는 매니징 알림").
 * Realtime 구독은 저장 성공 응답을 받은 직후 setWatchedId()로 시작한다 — 로그인 시점이 아니다.
 * 코스 화면 위에서는 각 화면이 pendingAlert를 읽어 확인 모달을 직접 그리고,
 * 그 외 화면(마이페이지·케어 등)에서는 AlertListener가 전역 배너만 띄운다.
 */
type WatchState = {
  watchedId: string | null;
  setWatchedId: (id: string | null) => void;
  pendingAlert: AlertPayload | null;
  clearAlert: () => void;
};

const WatchContext = createContext<WatchState | null>(null);

export function WatchProvider({ children }: { children: ReactNode }) {
  const [watchedId, setWatchedId] = useState<string | null>(null);
  const [pendingAlert, setPendingAlert] = useState<AlertPayload | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    if (!watchedId) return;
    unsubscribeRef.current = subscribeAlerts(watchedId, (payload) => {
      setPendingAlert(payload);
    });
    return () => {
      unsubscribeRef.current?.();
    };
  }, [watchedId]);

  const clearAlert = useCallback(() => setPendingAlert(null), []);

  return (
    <WatchContext.Provider value={{ watchedId, setWatchedId, pendingAlert, clearAlert }}>
      {children}
    </WatchContext.Provider>
  );
}

export function useWatch() {
  const ctx = useContext(WatchContext);
  if (!ctx) throw new Error("useWatch must be used within WatchProvider");
  return ctx;
}
