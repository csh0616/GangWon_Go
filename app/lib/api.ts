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
  NarrateRequestDay,
  NarrateResponseData,
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
import { getSession } from "./auth";
import { publishAlert, subscribeAlerts } from "./mock/realtime";
import { getSessionSaved, listSessionSaved, putSessionSaved } from "./mock/sessionSavedStore";

export { subscribeAlerts };

// 실제 백엔드가 붙으면 이 값만 채우면 됨 (PRD 3장 — 프론트 Vercel / 백엔드 Railway 또는 Render)
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? null;
const USE_MOCK = !API_BASE;

const REQUEST_TIMEOUT_MS = 20000;

function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function authError(): ApiResult<never> {
  return { data: null, error: { code: "AUTH_REQUIRED", message: "로그인이 필요해요." } };
}

function networkError(message = "네트워크 연결을 확인해주세요."): ApiResult<never> {
  return { data: null, error: { code: "NETWORK_ERROR", message } };
}

function looksLikeApiResult(value: unknown): value is { data: unknown; error: unknown } {
  return typeof value === "object" && value !== null && "data" in value && "error" in value;
}

/**
 * 모든 실 API 호출의 공용 진입점 — 절대 throw하지 않는다(P0-A, HANDOFF_LOG 배포본 3차 점검).
 * 이전에는 각 함수가 fetch를 try/catch 없이 호출하고 res.json()을 그대로 반환했는데, CORS 차단·
 * 타임아웃·네트워크 오류로 fetch가 reject하거나 res.json()이 파싱 예외를 던지면 그 예외가 호출부
 * (result 페이지의 runGenerate)까지 그대로 올라가 setState를 건너뛰고 loading 상태에 박제됐다.
 * 실패 경로는 전부 계약의 에러 형태({data:null, error:{code,message}})로 수렴시킨다.
 */
async function fetchApi<T>(
  url: string,
  init?: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch {
    // fetch 자체가 reject — 네트워크 단절, CORS 차단, AbortController 타임아웃 전부 여기로 모인다
    return networkError();
  } finally {
    clearTimeout(timeoutId);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // res.ok가 false인데 본문이 JSON이 아닌 경우(502 게이트웨이 HTML 등) 포함
    return networkError("서버 응답을 처리하지 못했어요.");
  }

  if (!looksLikeApiResult(body)) {
    return networkError("서버 응답 형식이 올바르지 않아요.");
  }

  return body as ApiResult<T>;
}

// ── 1. 코스 생성 (게스트 가능) ──────────────────────────────────────
export async function generateItinerary(
  request: GenerateRequest
): Promise<ApiResult<GenerateResponseData>> {
  if (USE_MOCK) {
    return delay(mockGenerate(request), 900);
  }
  return fetchApi<GenerateResponseData>(`${API_BASE}/api/itineraries/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

const NARRATE_TIMEOUT_MS = 10000; // API_CONTRACT.md §1 — 10초 넘으면 프론트가 포기하고 설명 없이 남김

/**
 * /generate가 뼈대만 돌려준 뒤(narration/blurb는 항상 null) 프론트가 이어서 호출해 설명을 채운다.
 * 실패해도 서버가 200 + 전부 null로 응답하므로(계약), 여기서도 에러를 사용자에게 알리지 않고
 * 호출부가 조용히 "설명 없는 코스"를 유지하도록 그대로 반환한다.
 */
export async function narrateItinerary(
  lang: GenerateRequest["lang"],
  selectedRegions: GenerateResponseData["selected_regions"],
  days: NarrateRequestDay[]
): Promise<ApiResult<NarrateResponseData>> {
  if (USE_MOCK) {
    // 목업은 /generate 단계에서 이미 narration/blurb를 채워 넣으므로(app/lib/mock/generate.ts),
    // 여기서는 아무것도 새로 채우지 않는 빈 응답을 흉내낸다 — 실제 병합 로직(app/[locale]/result/page.tsx)이
    // "값이 있을 때만 덮어쓴다"로 짜여 있어 기존 목업 값이 그대로 유지된다.
    return delay({ data: { narration: { ko: null, en: null, zh: null }, region_reason: null, blurbs: [] }, error: null }, 400);
  }
  return fetchApi<NarrateResponseData>(
    `${API_BASE}/api/itineraries/narrate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang, selected_regions: selectedRegions, days }),
    },
    NARRATE_TIMEOUT_MS
  );
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
  return fetchApi<SaveItineraryResponseData>(`${API_BASE}/api/itineraries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: JSON.stringify(request),
  });
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
  return fetchApi<SavedItineraryDetail>(`${API_BASE}/api/itineraries/${id}`, {
    headers: session ? { Authorization: `Bearer ${session.token}` } : {},
  });
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
  return fetchApi<{ itineraries: SavedItinerarySummary[] }>(`${API_BASE}/api/itineraries`, {
    headers: session ? { Authorization: `Bearer ${session.token}` } : {},
  });
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
  return fetchApi<{ id: string; status: "cancelled" }>(`${API_BASE}/api/itineraries/${id}`, {
    method: "DELETE",
    headers: session ? { Authorization: `Bearer ${session.token}` } : {},
  });
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
  return fetchApi<AlertPayload>(`${API_BASE}/api/alerts/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: JSON.stringify({ itinerary_id: itineraryId, trigger_type: "weather", condition: "rain", day, target_poi_id: targetPoiId }),
  });
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
  return fetchApi<{ status: "confirmed" | "dismissed"; updated_stop?: { poi_id: string; day: number } }>(
    `${API_BASE}/api/alerts/${alertId}/respond`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: JSON.stringify({ response }),
    }
  );
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
  return fetchApi<{ candidates: RegenerateCandidate[] }>(`${API_BASE}/api/itineraries/regenerate-stop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: JSON.stringify({ itinerary_id: itineraryId, day, target_poi_id: targetPoiId, reason: "user_request", free_text: freeText }),
  });
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
  return fetchApi<{ itinerary_json: SavedItineraryDetail["itinerary_json"]; day_reordered: boolean }>(
    `${API_BASE}/api/itineraries/${itineraryId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: JSON.stringify({ day, target_poi_id: targetPoiId, new_poi_id: newPoiId }),
    }
  );
}

// ── 4. 여행 케어 안내 (로그인 불필요) ──────────────────────────────
export async function getCare(regionCode: RegionCode): Promise<ApiResult<CareFacility[]>> {
  if (USE_MOCK) {
    return delay({ data: careForRegion(regionCode), error: null });
  }
  return fetchApi<CareFacility[]>(`${API_BASE}/api/care?region_code=${regionCode}`);
}

export type { Relationship };
