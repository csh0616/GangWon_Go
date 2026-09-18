import { supabase, isSupabaseConfigured } from "./supabase";
import type { AlertPayload, AlertTriggerType, AlertCondition, CategoryKey } from "./types";

/**
 * 실제 Supabase Realtime 채널 구독 (리포트 03) — app/lib/mock/realtime.ts의 인메모리 pub/sub은
 * 같은 탭 안에서 triggerAlert()가 호출될 때만 발행되는 데모용 흉내였다. 실제로는 감시
 * 에이전트가 alerts row를 insert해도 프론트 어디에도 도달하지 않았다. 여기서는 진짜
 * `alerts:itinerary_id=eq.{id}` 채널을 구독한다(API_CONTRACT.md §3).
 *
 * alerts row가 보내주는 값과 화면이 필요로 하는 AlertPayload 사이에는 간극이 있다 — DB
 * row에는 message(안내 문구)도, proposed_poi_id의 이름/카테고리 같은 상세 정보도 없다
 * (server/db/migrations/0001_init_schema.sql — alerts 테이블에 이 컬럼들 자체가 없음,
 * REST 응답(`/api/alerts/trigger`)에서만 서버가 pois와 조인해 조립한다). 백엔드 변경 없이는
 * 이 조립을 프론트가 대신할 수밖에 없다:
 * - previous_poi_id는 이미 화면에 로드된 itineraryJson에서 찾을 수 있어(스냅샷 참조 —
 *   FK는 아니지만 poi_id 값 자체는 같다) AlertModal이 이미 그렇게 하고 있다. 여기서는
 *   문자열 그대로만 실어 보낸다.
 * - proposed_poi_id(교체 후보)는 화면에 없는 새 장소라 pois 테이블에서 직접 조회해야
 *   한다. pois는 게스트도 코스를 보므로 공개 읽기 정책이 있어(`pois_public_read`) anon
 *   key로 바로 조회 가능 — 새 백엔드 엔드포인트가 필요 없다.
 * - message는 DB 어디에도 저장돼 있지 않아 프론트가 지어낼 수 없다 — null로 둔다.
 *   AlertModal은 이미 message가 없으면 그 줄을 그리지 않도록 돼 있어(`{message && ...}`)
 *   깨지지 않는다. "강제 트리거" 데모 버튼 경로(REST 응답)에는 여전히 문구가 실려 온다 —
 *   실제 Realtime 경로만 문구 한 줄이 빠지는 의도된 비대칭이다.
 */

type AlertsRow = {
  id: string;
  itinerary_id: string;
  trigger_type: string;
  condition: string;
  triggered_at: string;
  status: string;
  day: number;
  previous_poi_id: string;
  proposed_poi_id: string;
};

type CandidatePoi = AlertPayload["proposed_stop"]["candidate_poi"];

async function fetchCandidatePoi(poiId: string): Promise<CandidatePoi | null> {
  const { data, error } = await supabase
    .from("pois")
    .select("id, name, name_en, name_zh, tags, is_indoor, lat, lng")
    .eq("id", poiId)
    .maybeSingle();
  if (error || !data) return null;

  // pois.category는 TourAPI 원본 코드다(마스터 키 아님) — tags[0]이 실제 마스터 키다.
  // API_CONTRACT.md §1 상자와 동일한 원칙, REST 응답도 이렇게 매핑한다.
  const tags = Array.isArray(data.tags) ? (data.tags as string[]) : [];
  const category = tags[0] as CategoryKey | undefined;
  if (!category) return null;

  return {
    poi_id: data.id as string,
    name: { ko: (data.name as string) ?? null, en: (data.name_en as string | null) ?? null, zh: (data.name_zh as string | null) ?? null },
    category,
    is_indoor: Boolean(data.is_indoor),
    lat: data.lat as number,
    lng: data.lng as number,
  };
}

function toAlertPayload(row: AlertsRow, candidate: CandidatePoi): AlertPayload {
  return {
    alert_id: row.id,
    itinerary_id: row.itinerary_id,
    trigger_type: row.trigger_type as AlertTriggerType,
    condition: row.condition as AlertCondition,
    status: "proposed",
    message: { ko: null, en: null, zh: null },
    proposed_stop: {
      day: row.day,
      previous_poi_id: row.previous_poi_id,
      candidate_poi: candidate,
    },
    triggered_at: row.triggered_at,
  };
}

export function subscribeAlerts(itineraryId: string, listener: (payload: AlertPayload) => void): () => void {
  // 알림은 부가 기능이다 — 설정이 없거나 구독이 실패해도 코스 화면은 그대로 떠야 한다.
  if (!isSupabaseConfigured) return () => {};

  try {
    let cancelled = false;
    const channel = supabase
      .channel(`alerts:itinerary_id=eq.${itineraryId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts", filter: `itinerary_id=eq.${itineraryId}` },
        (payload) => {
          const row = payload.new as AlertsRow;
          if (row.status !== "proposed") return;
          fetchCandidatePoi(row.proposed_poi_id)
            .then((candidate) => {
              if (cancelled || !candidate) return;
              listener(toAlertPayload(row, candidate));
            })
            .catch(() => {
              // pois 조회 실패 — 이 알림 한 건만 조용히 버린다(가짜 정보로 모달을 띄우지 않는다)
            });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}
