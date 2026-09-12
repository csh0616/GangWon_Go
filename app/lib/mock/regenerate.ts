import type { RegenerateCandidate, RegionCode } from "../types";
import { poisByRegion } from "./pois";

/**
 * POST /api/itineraries/regenerate-stop 후보 목록 목업. 계약은 "최대 3개"이지 항상 3개가 아니다
 * (API_CONTRACT.md §3) — 이미 코스에 쓰인 POI를 제외하고 나면 시군 POI 풀이 작아 자연스럽게
 * 1~2개만 남는 경우가 실제로 생긴다(design/artboards/ReplaceStopTwo.dc.html 참고).
 */
export function mockRegenerateCandidates(
  region: RegionCode,
  excludePoiIds: string[]
): RegenerateCandidate[] {
  return poisByRegion(region)
    .filter((p) => !excludePoiIds.includes(p.poi_id))
    .slice(0, 3)
    .map((p) => ({
      poi_id: p.poi_id,
      name: p.name,
      category: p.category,
      is_indoor: p.is_indoor,
      lat: p.lat,
      lng: p.lng,
      blurb: p.blurb,
    }));
}
