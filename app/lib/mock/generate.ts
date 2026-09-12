import type {
  ApiResult,
  CategoryKey,
  Day,
  GenerateRequest,
  GenerateResponseData,
  Localized,
  PreferenceWeights,
  RegionCode,
  Stop,
  TravelBetweenDays,
} from "../types";
import { MOCK_POIS, poiById, type MockPoi } from "./pois";
import { REGION_MASTER } from "../regions";

/**
 * 목업 코스 생성 엔진 (docs/API_CONTRACT.md §1 응답 형태를 그대로 흉내).
 *
 * 실제 LLM/DB/2-opt 대신, 시군별로 정해둔 순서(REGION_STOP_ORDER)에서 POI를 그날그날 3개씩
 * 순서대로 뽑아 채운다 — "평창 단독 3일(스탑 8곳)" 등 프론트 세션 프롬프트가 요구한 케이스를
 * 실제 폼 입력(날짜·지역)에 반응해서 재현할 수 있도록 하기 위함이다. 특수 케이스(이름 번역 누락 등)는
 * 고정 순서 앞쪽에 배치해두어 어떤 조합을 선택해도 자연스럽게 드러난다.
 *
 * QA/개발용 트리거: free_text에 아래 마커 문자열이 포함되면 해당 에러를 강제로 반환한다.
 *   "[[NO_CANDIDATE]]"    → NO_CANDIDATE
 *   "[[INTERNAL_ERROR]]"  → INTERNAL_ERROR
 */

const REGION_STOP_ORDER: Partial<Record<RegionCode, string[]>> = {
  pyeongchang: [
    "poi_pc_01",
    "poi_pc_05", // name.en = null — 첫 날에 반드시 걸리도록 앞쪽 배치
    "poi_pc_02",
    "poi_pc_03",
    "poi_pc_04",
    "poi_pc_06",
    "poi_pc_07",
    "poi_pc_08",
  ],
  hongcheon: [
    "poi_hc_01",
    "poi_hc_03",
    "poi_hc_04", // blurb.en = null
    "poi_hc_02",
    "poi_hc_05",
    "poi_hc_06",
  ],
  injae: ["poi_ij_01", "poi_ij_02", "poi_ij_03", "poi_ij_04", "poi_ij_05"],
};

function stopOrderFor(region: RegionCode): string[] {
  return REGION_STOP_ORDER[region] ?? MOCK_POIS.filter((p) => p.region_code === region).map((p) => p.poi_id);
}

// ── KST 안전 날짜 유틸 (문자열 기준 계산, 브라우저 타임존에 의존하지 않음) ──
function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function diffDaysInclusive(start: string, end: string): number {
  return Math.round((ymdToUtcMs(end) - ymdToUtcMs(start)) / 86_400_000) + 1;
}
function addDaysStr(start: string, n: number): string {
  const ms = ymdToUtcMs(start) + n * 86_400_000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildStop(poi: MockPoi, order: number, travelFromPrev: Stop["travel_from_prev"], opts: { nullBlurb: boolean }): Stop {
  return {
    poi_id: poi.poi_id,
    name: poi.name,
    category: poi.category,
    is_indoor: poi.is_indoor,
    lat: poi.lat,
    lng: poi.lng,
    order,
    blurb: opts.nullBlurb ? { ko: null, en: null, zh: null } : poi.blurb,
    travel_from_prev: travelFromPrev,
  };
}

function travelForIndex(index: number, nullTravel: boolean): Stop["travel_from_prev"] {
  if (index === 0) return null;
  if (nullTravel) return null;
  // 짝을 지어 걷기/차량을 섞어 화면에서 두 모드가 다 보이도록 함
  if (index % 3 === 1) return { mode: "walk", minutes: 8 + index };
  return { mode: "car", minutes: 15 + index * 9 };
}

function regionLat(region: RegionCode): number {
  return REGION_MASTER.find((r) => r.code === region)?.lat ?? 0;
}

function travelBetween(fromRegion: RegionCode, toRegion: RegionCode, nullTravel: boolean): TravelBetweenDays {
  if (nullTravel) return null;
  if (fromRegion === toRegion) {
    return { from_region_code: fromRegion, to_region_code: toRegion, mode: "car", minutes: 22 };
  }
  const dLat = Math.abs(regionLat(fromRegion) - regionLat(toRegion));
  const minutes = Math.max(35, Math.round(dLat * 90));
  return { from_region_code: fromRegion, to_region_code: toRegion, mode: "car", minutes };
}

type DayPlan = { region_code: RegionCode; forceEmpty?: boolean };

type BuildOptions = {
  nullBlurbs?: boolean;
  nullTravel?: boolean;
};

function buildDays(request: GenerateRequest, dayPlans: DayPlan[], opts: BuildOptions = {}): Day[] {
  const regionOffsets = new Map<RegionCode, number>();
  const days: Day[] = [];

  dayPlans.forEach((plan, i) => {
    const date = addDaysStr(request.start_date, i);
    let stops: Stop[] = [];

    if (!plan.forceEmpty) {
      const order = stopOrderFor(plan.region_code);
      const offset = regionOffsets.get(plan.region_code) ?? 0;
      const picked = [];
      for (let k = 0; k < 3 && offset + k < order.length; k++) {
        picked.push(order[(offset + k) % order.length]);
      }
      regionOffsets.set(plan.region_code, offset + picked.length);
      stops = picked
        .map((id) => poiById(id))
        .filter((p): p is MockPoi => Boolean(p))
        .map((poi, idx) =>
          buildStop(poi, idx + 1, travelForIndex(idx, Boolean(opts.nullTravel)), {
            nullBlurb: Boolean(opts.nullBlurbs),
          })
        );
    }

    // travel_from_prev_day: day1은 항상 null. 그 외엔 스탑이 있던 마지막 이전 날을 기준으로 계산.
    let travelFromPrevDay: TravelBetweenDays = null;
    if (i > 0) {
      let j = days.length - 1;
      while (j >= 0 && days[j].stops.length === 0) j--;
      if (j >= 0) {
        travelFromPrevDay = travelBetween(days[j].region_code, plan.region_code, Boolean(opts.nullTravel));
      }
    }

    days.push({
      day: i + 1,
      date,
      region_code: plan.region_code,
      travel_from_prev_day: travelFromPrevDay,
      stops,
    });
  });

  return days;
}

/** PRD 3.5절 2.5단계: 위도 내림차순 정렬 후 연속 날짜 블록으로 배분(나머지는 앞쪽 시군부터) */
function assignRegionsToDays(regionCodes: RegionCode[], dayCount: number): RegionCode[] {
  const sorted = [...new Set(regionCodes)].sort((a, b) => regionLat(b) - regionLat(a));
  const base = Math.floor(dayCount / sorted.length);
  const remainder = dayCount % sorted.length;
  const plan: RegionCode[] = [];
  sorted.forEach((region, i) => {
    const count = base + (i < remainder ? 1 : 0);
    for (let k = 0; k < count; k++) plan.push(region);
  });
  return plan;
}

// ── 취향 가중치 (목업: free_text 키워드 매칭, 비어있으면 전부 0 — 계약과 동일한 폴백) ──
const KEYWORD_MAP: [RegExp, CategoryKey][] = [
  [/등산|하이킹|숲|트레킹|자연|hiking|trail|forest|nature/i, "nature_hiking"],
  [/온천|스파|웰니스|onsen|spa|wellness|hot spring/i, "onsen_wellness"],
  [/문화|역사|박물관|전시|culture|history|museum|exhibit/i, "culture_history"],
  [/맛집|음식|미식|먹거리|food|local food|cuisine/i, "food_local"],
  [/축제|이벤트|festival|event/i, "festival_event"],
  [/쇼핑|시장|shopping|market/i, "shopping"],
  [/레포츠|액티비티|스키|래프팅|카약|짚라인|sports|ski|rafting|kayak|activity/i, "leisure_sports"],
];

const ALL_CATEGORIES: CategoryKey[] = [
  "nature_hiking",
  "onsen_wellness",
  "culture_history",
  "food_local",
  "festival_event",
  "shopping",
  "leisure_sports",
];

function weightsFromFreeText(freeText: string): PreferenceWeights {
  const base: PreferenceWeights = {
    nature_hiking: 0,
    onsen_wellness: 0,
    culture_history: 0,
    food_local: 0,
    festival_event: 0,
    shopping: 0,
    leisure_sports: 0,
  };
  if (!freeText.trim()) return base;

  const matched = new Set<CategoryKey>();
  for (const [re, cat] of KEYWORD_MAP) {
    if (re.test(freeText)) matched.add(cat);
  }
  // 매칭된 카테고리는 높게, 나머지는 낮은 기본값으로 — 실제 LLM 출력처럼 전부 0은 아니게
  ALL_CATEGORIES.forEach((cat, i) => {
    if (matched.has(cat)) base[cat] = 0.75 + (i % 2) * 0.1;
    else base[cat] = 0.15 + (i % 3) * 0.1;
  });
  if (matched.size === 0) {
    // 키워드가 전혀 안 걸려도 "여유롭게/힐링" 류 텍스트는 자연 카테고리 하나만 살짝 올려줌
    base.nature_hiking = 0.55;
  }
  return base;
}

function localized(ko: string, en: string, zh: string): Localized {
  return { ko, en, zh };
}

export function mockGenerate(request: GenerateRequest): ApiResult<GenerateResponseData> {
  const dayCount = diffDaysInclusive(request.start_date, request.end_date);
  const regionCodes = [...new Set(request.region_codes)];

  if (regionCodes.length > dayCount) {
    return {
      data: null,
      error: {
        code: "INVALID_STRUCTURED_INPUT",
        message: "여행 일수보다 많은 시군은 고를 수 없어요.",
      },
    };
  }
  if (regionCodes.length === 0 && !request.free_text.trim()) {
    return {
      data: null,
      error: {
        code: "INVALID_STRUCTURED_INPUT",
        message: "어떤 여행을 원하시는지 적어주셔야 지역을 골라드릴 수 있어요.",
      },
    };
  }
  if (request.free_text.includes("[[NO_CANDIDATE]]")) {
    return {
      data: null,
      error: { code: "NO_CANDIDATE", message: "조건에 맞는 장소를 찾지 못했어요." },
    };
  }
  if (request.free_text.includes("[[INTERNAL_ERROR]]")) {
    return {
      data: null,
      error: { code: "INTERNAL_ERROR", message: "잠시 문제가 생겼어요." },
    };
  }

  const isAuto = regionCodes.length === 0;
  const isNullHeavy = !isAuto && regionCodes.length === 1 && regionCodes[0] === "injae";
  const forceLastDayEmpty = dayCount === 4;

  const effectiveRegions: RegionCode[] = isAuto ? ["hongcheon", "pyeongchang"] : regionCodes;
  const regionPlan = assignRegionsToDays(effectiveRegions, dayCount);
  const dayPlans: DayPlan[] = regionPlan.map((region_code, i) => ({
    region_code,
    forceEmpty: forceLastDayEmpty && i === dayCount - 1,
  }));

  const days = buildDays(request, dayPlans, {
    nullBlurbs: isNullHeavy,
    nullTravel: isNullHeavy,
  });

  const weights = isNullHeavy ? weightsFromFreeText("") : weightsFromFreeText(request.free_text);

  const narration: Localized = isNullHeavy
    ? { ko: null, en: null, zh: null }
    : isAuto
      ? localized(
          "숲길과 조용한 전시를 원하셔서 홍천과 평창을 골랐어요. 걷는 속도가 느린 코스로 짰어요.",
          "You asked for forest trails and quiet exhibitions, so we picked Hongcheon and Pyeongchang — paced for slow walking.",
          "您想要林间小路和安静的展览，所以我们选择了洪川和平昌 —— 以缓慢的步调安排。"
        )
      : effectiveRegions.length > 1
        ? localized(
            "홍천에서 시작해 평창으로 넘어가는, 계곡과 미술관을 오가는 코스예요.",
            "Starting in Hongcheon and moving to Pyeongchang, alternating between valleys and galleries.",
            "从洪川出发前往平昌，在溪谷与美术馆之间穿梭的行程。"
          )
        : localized(
            "전나무 숲길에서 시작해 고원의 맛과 풍경을 즐기는 코스예요.",
            "Starting on the fir-lined trail, then enjoying the highland's tastes and views.",
            "从冷杉林道出发，享受高原的美食与风景。"
          );

  const regionReason: Localized | null = isAuto
    ? localized(
        "숲길과 조용한 전시를 원하셔서 홍천과 평창을 골랐어요.",
        "You asked for forest trails and quiet exhibitions, so we picked Hongcheon and Pyeongchang.",
        "您想要林间小路和安静的展览，所以我们选择了洪川和平昌。"
      )
    : null;

  const data: GenerateResponseData = {
    itinerary_json: { days, narration, region_reason: regionReason },
    selected_regions: { auto: isAuto, region_codes: effectiveRegions },
    preference_weights: weights,
    generated_at: new Date().toISOString(),
  };

  return { data, error: null };
}
