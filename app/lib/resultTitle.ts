import type { RegionCode } from "./types";

/** "Pyeongchang 3-day course" / "平昌3日行程" 형태의 코스 제목 조립 */
export function buildResultTitle(
  regionCodes: RegionCode[],
  dayCount: number,
  regionName: (code: RegionCode) => string,
  titleSuffix: string
): string {
  const regionsLabel = regionCodes.map(regionName).join(" · ");
  return `${regionsLabel} ${dayCount}${titleSuffix}`;
}
