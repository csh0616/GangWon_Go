import type { AlertPayload } from "../types";

/**
 * Supabase Realtime 채널 목업 (`alerts:itinerary_id=eq.{id}`, API_CONTRACT.md §3).
 * 실제로는 새 `alerts` row가 insert되면 push되는데, 목업에서는 `triggerAlert()` 호출 시점에
 * 여기로 publish해 같은 itinerary_id를 구독 중인 리스너에게 전달한다.
 *
 * 구독 시작 시점은 로그인이 아니라 **저장 성공 응답 직후**여야 한다 (PRD 6장) — 이 함수 자체는
 * 언제 호출되든 상관없이 동작하므로, 호출 시점을 지키는 책임은 호출부(컴포넌트)에 있다.
 */
type Listener = (payload: AlertPayload) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribeAlerts(itineraryId: string, listener: Listener): () => void {
  if (!listeners.has(itineraryId)) listeners.set(itineraryId, new Set());
  listeners.get(itineraryId)!.add(listener);
  return () => {
    listeners.get(itineraryId)?.delete(listener);
  };
}

export function publishAlert(itineraryId: string, payload: AlertPayload) {
  listeners.get(itineraryId)?.forEach((cb) => cb(payload));
}
