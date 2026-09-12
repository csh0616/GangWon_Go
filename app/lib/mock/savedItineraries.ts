import type {
  GenerateRequest,
  ItineraryJson,
  PreferenceWeights,
  Relationship,
  SavedItineraryDetail,
  SavedItinerarySummary,
} from "../types";
import { mockGenerate } from "./generate";

/**
 * GET /api/itineraries (마이페이지 목록) / GET /api/itineraries/:id 목업.
 * 진행 중 2건 + 지난 여행 1건 (API_CONTRACT.md §2 — "진행 중/지난 여행" 구분은 프론트가 end_date로 판정).
 * itinerary_json은 mockGenerate를 재사용해 §1과 동일한 형태를 보장한다.
 */

function generateOrThrow(request: GenerateRequest): ItineraryJson {
  const result = mockGenerate(request);
  if (!result.data) throw new Error("mock fixture generation failed: " + result.error?.code);
  return result.data.itinerary_json;
}
function weightsOrThrow(request: GenerateRequest): PreferenceWeights {
  const result = mockGenerate(request);
  if (!result.data) throw new Error("mock fixture generation failed: " + result.error?.code);
  return result.data.preference_weights;
}

const REQ_ONGOING_1: GenerateRequest = {
  start_date: "2026-09-10",
  end_date: "2026-09-12",
  companions: 2,
  relationship: "couple",
  free_text: "숲길 걷고 조용한 전시 보면서 여유롭게 다니고 싶어요",
  region_codes: ["pyeongchang"],
  lang: "en",
};

const REQ_ONGOING_2: GenerateRequest = {
  start_date: "2026-09-20",
  end_date: "2026-09-22",
  companions: 4,
  relationship: "friends",
  free_text: "맛집이랑 래프팅 같은 레포츠 위주로",
  region_codes: ["hongcheon", "pyeongchang"],
  lang: "en",
};

const REQ_PAST: GenerateRequest = {
  start_date: "2025-09-01",
  end_date: "2025-09-03",
  companions: 1,
  relationship: "solo",
  free_text: "온천이랑 카약 타면서 힐링하고 싶어요",
  region_codes: ["injae"],
  lang: "en",
};

type MockSaved = SavedItineraryDetail & { created_at: string };

export const MOCK_SAVED_ITINERARIES: MockSaved[] = [
  {
    id: "itn_ongoing_pyeongchang",
    itinerary_json: generateOrThrow(REQ_ONGOING_1),
    preference_weights: weightsOrThrow(REQ_ONGOING_1),
    region_codes: REQ_ONGOING_1.region_codes,
    start_date: REQ_ONGOING_1.start_date,
    end_date: REQ_ONGOING_1.end_date,
    companions: REQ_ONGOING_1.companions,
    relationship: REQ_ONGOING_1.relationship as Relationship,
    status: "active",
    created_at: "2026-09-05T11:20:00+09:00",
  },
  {
    id: "itn_ongoing_hc_pc",
    itinerary_json: generateOrThrow(REQ_ONGOING_2),
    preference_weights: weightsOrThrow(REQ_ONGOING_2),
    region_codes: REQ_ONGOING_2.region_codes,
    start_date: REQ_ONGOING_2.start_date,
    end_date: REQ_ONGOING_2.end_date,
    companions: REQ_ONGOING_2.companions,
    relationship: REQ_ONGOING_2.relationship as Relationship,
    status: "active",
    created_at: "2026-09-08T09:40:00+09:00",
  },
  {
    id: "itn_past_injae",
    itinerary_json: generateOrThrow(REQ_PAST),
    preference_weights: weightsOrThrow(REQ_PAST),
    region_codes: REQ_PAST.region_codes,
    start_date: REQ_PAST.start_date,
    end_date: REQ_PAST.end_date,
    companions: REQ_PAST.companions,
    relationship: REQ_PAST.relationship as Relationship,
    status: "active",
    created_at: "2025-08-20T14:05:00+09:00",
  },
];

export function mockSavedList(): SavedItinerarySummary[] {
  return MOCK_SAVED_ITINERARIES.filter((it) => it.status !== "cancelled").map((it) => ({
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
}

export function mockSavedDetail(id: string): SavedItineraryDetail | null {
  const found = MOCK_SAVED_ITINERARIES.find((it) => it.id === id && it.status !== "cancelled");
  if (!found) return null;
  const { created_at: _createdAt, ...detail } = found;
  return detail;
}
