/**
 * 데이터 레이어 단일 진입점. 지금은 전부 목업(app/lib/mock/*)을 반환하고, 실제 백엔드가 준비되면
 * 이 파일 안의 함수 본문만 fetch(`${API_BASE}/...`)로 바꾸면 된다 — 호출부(컴포넌트)는 그대로.
 *
 * 모든 응답은 API_CONTRACT.md §0과 동일하게 `{ data, error }` 형태의 ApiResult<T>를 반환한다.
 */
import type {
  AlertPayload,
  ApiResult,
  CareFacility,
  GenerateRequest,
  GenerateResponseData,
  RegenerateCandidate,
  RegionCode,
  Relationship,
  SavedItineraryDetail,
  SavedItinerarySummary,
  SaveItineraryRequest,
  SaveItineraryResponseData,
} from "./types";
import { mockGenerate } from "./mock/generate";
import { careForRegion } from "./mock/care";
import {
  MOCK_SAVED_ITINERARIES,
  mockSavedDetail,
  mockSavedList,
} from "./mock/savedItineraries";
import { buildMockAlert } from "./mock/alerts";
import { mockRegenerateCandidates } from "./mock/regenerate";
import { getSession } from "./mock/auth";
import { publishAlert, subscribeAlerts } from "./mock/realtime";
import { getSessionSaved, listSessionSaved, putSessionSaved } from "./mock/sessionSavedStore";

export { subscribeAlerts };

// 실제 백엔드가 붙으면 이 값만 채우면 됨 (PRD 3장 — 프론트 Vercel / 백엔드 Railway 또는 Render)
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? null;
const USE_MOCK = !API_BASE;

function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function authError(): ApiResult<never> {
  return { data: null, error: { code: "AUTH_REQUIRED", message: "로그인이 필요해요." } };
}

// ── 1. 코스 생성 (게스트 가능) ──────────────────────────────────────
export async function generateItinerary(
  request: GenerateRequest
): Promise<ApiResult<GenerateResponseData>> {
  if (USE_MOCK) {
    return delay(mockGenerate(request), 900);
  }
  const res = await fetch(`${API_BASE}/api/itineraries/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return res.json();
}

// ── 2. 코스 저장 (로그인 필요) ──────────────────────────────────────
// 실제 DB가 없는 목업 환경 — sessionStorage에 함께 반영해 새로고침·뒤로가기에도 살아남게 한다
// (mock/sessionSavedStore.ts). "저장된 코스는 /itinerary/:id 주소를 가져야 한다"는 요구사항 근거.
export async function saveItinerary(
  request: SaveItineraryRequest
): Promise<ApiResult<SaveItineraryResponseData>> {
  if (USE_MOCK) {
    const session = getSession();
    if (!session) return delay(authError());
    const id = `itn_session_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    putSessionSaved({
      id,
      ...request,
      status: "active",
      created_at: new Date().toISOString(),
    });
    return delay({
      data: { itinerary_id: id, status: "active" as const, user_id: session.user_id },
      error: null,
    });
  }
  const session = getSession();
  const res = await fetch(`${API_BASE}/api/itineraries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: JSON.stringify(request),
  });
  return res.json();
}

export async function getItinerary(id: string): Promise<ApiResult<SavedItineraryDetail>> {
  if (USE_MOCK) {
    const fromSession = getSessionSaved(id);
    if (fromSession) {
      const { created_at: _createdAt, ...detail } = fromSession;
      return delay({ data: detail, error: null });
    }
    const found = mockSavedDetail(id);
    if (!found) {
      return delay({ data: null, error: { code: "NOT_FOUND", message: "일정을 찾을 수 없어요." } });
    }
    return delay({ data: found, error: null });
  }
  const session = getSession();
  const res = await fetch(`${API_BASE}/api/itineraries/${id}`, {
    headers: session ? { Authorization: `Bearer ${session.token}` } : {},
  });
  return res.json();
}

export async function listItineraries(): Promise<ApiResult<{ itineraries: SavedItinerarySummary[] }>> {
  if (USE_MOCK) {
    const session = getSession();
    if (!session) return delay(authError());
    const extra: SavedItinerarySummary[] = listSessionSaved().map((it) => ({
      id: it.id,
      region_codes: it.region_codes,
      start_date: it.start_date,
      end_date: it.end_date,
      companions: it.companions,
      relationship: it.relationship,
      stop_count: it.itinerary_json.days.reduce((sum, d) => sum + d.stops.length, 0),
      status: it.status,
      created_at: it.created_at,
    }));
    return delay({ data: { itineraries: [...extra, ...mockSavedList()] }, error: null });
  }
  const session = getSession();
  const res = await fetch(`${API_BASE}/api/itineraries`, {
    headers: session ? { Authorization: `Bearer ${session.token}` } : {},
  });
  return res.json();
}

export async function deleteItinerary(id: string): Promise<ApiResult<{ id: string; status: "cancelled" }>> {
  if (USE_MOCK) {
    const session = getSession();
    if (!session) return delay(authError());
    const fromSession = getSessionSaved(id);
    if (fromSession) {
      putSessionSaved({ ...fromSession, status: "cancelled" });
    } else {
      const found = MOCK_SAVED_ITINERARIES.find((it) => it.id === id);
      if (found) found.status = "cancelled";
    }
    return delay({ data: { id, status: "cancelled" as const }, error: null });
  }
  const session = getSession();
  const res = await fetch(`${API_BASE}/api/itineraries/${id}`, {
    method: "DELETE",
    headers: session ? { Authorization: `Bearer ${session.token}` } : {},
  });
  return res.json();
}

// ── 3. 실시간 매니징 ────────────────────────────────────────────────
export async function triggerAlert(
  itineraryId: string,
  day: number,
  targetPoiId: string
): Promise<ApiResult<AlertPayload>> {
  if (USE_MOCK) {
    const session = getSession();
    if (!session) return delay(authError());
    const payload = buildMockAlert(itineraryId);
    payload.proposed_stop.day = day;
    payload.proposed_stop.previous_poi_id = targetPoiId;
    // Realtime push 흉내: 저장 직후부터 구독 중인 리스너(전역 배너/모달)에 전달
    setTimeout(() => publishAlert(itineraryId, payload), 900);
    return delay({ data: payload, error: null });
  }
  const session = getSession();
  const res = await fetch(`${API_BASE}/api/alerts/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: JSON.stringify({ itinerary_id: itineraryId, trigger_type: "weather", condition: "rain", day, target_poi_id: targetPoiId }),
  });
  return res.json();
}

export async function respondAlert(
  alertId: string,
  response: "yes" | "no"
): Promise<ApiResult<{ status: "confirmed" | "dismissed"; updated_stop?: { poi_id: string; day: number } }>> {
  if (USE_MOCK) {
    const session = getSession();
    if (!session) return delay(authError());
    if (response === "no") {
      return delay({ data: { status: "dismissed" as const }, error: null });
    }
    return delay({
      data: {
        status: "confirmed" as const,
        updated_stop: { poi_id: "poi_pc_99", day: 1 },
      },
      error: null,
    });
  }
  const session = getSession();
  const res = await fetch(`${API_BASE}/api/alerts/${alertId}/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: JSON.stringify({ response }),
  });
  return res.json();
}

export async function regenerateStop(
  itineraryId: string,
  day: number,
  targetPoiId: string,
  region: RegionCode,
  excludePoiIds: string[],
  freeText?: string
): Promise<ApiResult<{ candidates: RegenerateCandidate[] }>> {
  if (USE_MOCK) {
    const session = getSession();
    if (!session) return delay(authError());
    void freeText; // 목업에서는 키워드 재스코어링을 생략 (지역 필터만 반영)
    return delay({ data: { candidates: mockRegenerateCandidates(region, excludePoiIds) }, error: null });
  }
  const session = getSession();
  const res = await fetch(`${API_BASE}/api/itineraries/regenerate-stop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: JSON.stringify({ itinerary_id: itineraryId, day, target_poi_id: targetPoiId, reason: "user_request", free_text: freeText }),
  });
  return res.json();
}

export async function confirmStopReplacement(
  itineraryId: string,
  day: number,
  targetPoiId: string,
  newPoiId: string
): Promise<ApiResult<{ itinerary_json: SavedItineraryDetail["itinerary_json"]; day_reordered: boolean }>> {
  if (USE_MOCK) {
    const session = getSession();
    if (!session) return delay(authError());
    const fromSession = getSessionSaved(itineraryId);
    const record = fromSession ?? MOCK_SAVED_ITINERARIES.find((it) => it.id === itineraryId);
    if (!record) {
      return delay({ data: null, error: { code: "NOT_FOUND", message: "일정을 찾을 수 없어요." } });
    }
    const candidates = mockRegenerateCandidates(record.region_codes[0], []);
    const replacement = candidates.find((c) => c.poi_id === newPoiId) ?? candidates[0];
    const nextDays = record.itinerary_json.days.map((d) => {
      if (d.day !== day) return d;
      return {
        ...d,
        stops: d.stops.map((s) =>
          s.poi_id === targetPoiId && replacement
            ? {
                ...s,
                poi_id: replacement.poi_id,
                name: replacement.name,
                category: replacement.category,
                is_indoor: replacement.is_indoor,
                lat: replacement.lat,
                lng: replacement.lng,
                blurb: replacement.blurb,
              }
            : s
        ),
      };
    });
    const nextItineraryJson = { ...record.itinerary_json, days: nextDays };
    if (fromSession) {
      putSessionSaved({ ...fromSession, itinerary_json: nextItineraryJson });
    } else {
      record.itinerary_json = nextItineraryJson;
    }
    return delay({ data: { itinerary_json: nextItineraryJson, day_reordered: true }, error: null });
  }
  const session = getSession();
  const res = await fetch(`${API_BASE}/api/itineraries/${itineraryId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: JSON.stringify({ day, target_poi_id: targetPoiId, new_poi_id: newPoiId }),
  });
  return res.json();
}

// ── 4. 여행 케어 안내 (로그인 불필요) ──────────────────────────────
export async function getCare(regionCode: RegionCode): Promise<ApiResult<CareFacility[]>> {
  if (USE_MOCK) {
    return delay({ data: careForRegion(regionCode), error: null });
  }
  const res = await fetch(`${API_BASE}/api/care?region_code=${regionCode}`);
  return res.json();
}

export type { Relationship };
