/**
 * docs/API_CONTRACT.md 기준 타입 정의. 화면은 이 타입만 보고 만들면 되고,
 * 실제 백엔드 연동 시에도 이 파일은 바뀌지 않는 것이 목표입니다 (계약이 바뀌지 않는 한).
 */

export type Lang = "ko" | "en" | "zh";

export type Localized<T = string> = {
  ko: T | null;
  en: T | null;
  zh: T | null;
};

/** 열려 있는 시군 (데모 범위, PRD 1장) */
export type OpenRegionCode = "injae" | "hongcheon" | "pyeongchang";

/** 강원 18개 시군 코드 (순차 오픈 예정 포함, PRD 11.2절) */
export type RegionCode =
  | OpenRegionCode
  | "chuncheon"
  | "wonju"
  | "gangneung"
  | "donghae"
  | "taebaek"
  | "sokcho"
  | "samcheok"
  | "hoengseong"
  | "yeongwol"
  | "jeongseon"
  | "cheorwon"
  | "hwacheon"
  | "yanggu"
  | "goseong"
  | "yangyang"
  | "inje";

export type Relationship =
  | "couple"
  | "family_with_kids"
  | "friends"
  | "solo"
  | "group";

export type CategoryKey =
  | "nature_hiking"
  | "onsen_wellness"
  | "culture_history"
  | "food_local"
  | "festival_event"
  | "shopping"
  | "leisure_sports";

export type PreferenceWeights = Record<CategoryKey, number>;

export type ActivityLevel = "low" | "medium" | "high";

export type TravelMode = "car" | "walk";

export type Travel = {
  mode: TravelMode;
  minutes: number;
} | null;

export type TravelBetweenDays = {
  from_region_code: RegionCode;
  to_region_code: RegionCode;
  mode: TravelMode;
  minutes: number;
} | null;

export type Stop = {
  poi_id: string;
  name: Localized;
  category: CategoryKey;
  is_indoor: boolean;
  lat: number;
  lng: number;
  order: number;
  blurb: Localized | null;
  travel_from_prev: Travel;
};

export type Day = {
  day: number;
  date: string; // YYYY-MM-DD, KST — 그대로 표시, 재계산 금지
  region_code: RegionCode;
  travel_from_prev_day: TravelBetweenDays;
  stops: Stop[];
};

export type ItineraryJson = {
  days: Day[];
  narration: Localized;
  region_reason: Localized | null;
};

export type SelectedRegions = {
  auto: boolean;
  region_codes: RegionCode[];
};

export type GenerateResponseData = {
  itinerary_json: ItineraryJson;
  selected_regions: SelectedRegions;
  preference_weights: PreferenceWeights;
  generated_at: string;
};

export type GenerateRequest = {
  start_date: string;
  end_date: string;
  companions: number;
  relationship: Relationship;
  free_text: string;
  region_codes: RegionCode[]; // [] = 어디든지
  lang: Lang;
};

export type ErrorCode =
  | "INVALID_STRUCTURED_INPUT"
  | "INVALID_LANG"
  | "NO_POI_DATA"
  | "NO_CANDIDATE"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ALERT_EXPIRED"
  | "STOP_NOT_FOUND"
  | "INTERNAL_ERROR";

export type ApiError = {
  code: ErrorCode;
  message: string;
};

export type ApiResult<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };

export type ItineraryStatus = "draft" | "active" | "completed" | "cancelled";

export type SavedItinerarySummary = {
  id: string;
  region_codes: RegionCode[];
  start_date: string;
  end_date: string;
  companions: number;
  relationship: Relationship;
  stop_count: number;
  status: ItineraryStatus;
  created_at: string;
};

export type SaveItineraryRequest = {
  itinerary_json: ItineraryJson;
  preference_weights: PreferenceWeights;
  region_codes: RegionCode[];
  start_date: string;
  end_date: string;
  companions: number;
  relationship: Relationship;
};

export type SaveItineraryResponseData = {
  itinerary_id: string;
  status: ItineraryStatus;
  user_id: string;
};

export type SavedItineraryDetail = SaveItineraryRequest & {
  id: string;
  status: ItineraryStatus;
};

/** alerts payload — Realtime & /api/alerts/trigger 공용 (API_CONTRACT.md §3) */
export type AlertTriggerType = "weather" | "traffic" | "festival";
export type AlertCondition = "rain" | "traffic" | "festival_cancelled";
export type AlertStatus = "proposed" | "confirmed" | "dismissed";

export type AlertPayload = {
  alert_id: string;
  itinerary_id: string;
  trigger_type: AlertTriggerType;
  condition: AlertCondition;
  status: AlertStatus;
  message: Localized;
  proposed_stop: {
    day: number;
    previous_poi_id: string;
    candidate_poi: {
      poi_id: string;
      name: Localized;
      category: CategoryKey;
      is_indoor: boolean;
      lat: number;
      lng: number;
    };
  };
  triggered_at: string;
};

export type RegenerateCandidate = {
  poi_id: string;
  name: Localized;
  category: CategoryKey;
  is_indoor: boolean;
  lat: number;
  lng: number;
  blurb: Localized;
};

export type CareFacility = {
  name_ko: string;
  name_en: string | null;
  name_zh: string | null;
  category: "emergency_room" | "health_center" | "health_subcenter" | "hospital";
  phone: string | null;
  address_ko: string;
  lat: number;
  lng: number;
};
