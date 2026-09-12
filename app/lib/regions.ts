import type { OpenRegionCode, RegionCode } from "./types";

/**
 * 강원 18개 시군 마스터 목록 (PRD 11.2절, design/artboards/Main.dc.html 칩 순서).
 * `open`인 3개(인제·홍천·평창)만 실제로 선택 가능하고 나머지는 "순차 오픈 예정"으로 비활성 표시한다.
 * `lat`은 위도 내림차순 정렬(PRD 3.5절 2.5단계, 북→남 날짜 배정) 근거를 문서화해두는 용도 —
 * 실제 날짜 배정은 서버가 계산해 `days[].region_code`로 내려주므로 프론트는 이 값으로 재계산하지 않는다.
 */
export const REGION_MASTER: {
  code: RegionCode;
  lat: number;
  open: boolean;
}[] = [
  { code: "injae", lat: 38.07, open: true },
  { code: "hongcheon", lat: 37.7, open: true },
  { code: "pyeongchang", lat: 37.37, open: true },
  { code: "chuncheon", lat: 37.88, open: false },
  { code: "wonju", lat: 37.34, open: false },
  { code: "gangneung", lat: 37.75, open: false },
  { code: "donghae", lat: 37.52, open: false },
  { code: "taebaek", lat: 37.16, open: false },
  { code: "sokcho", lat: 38.21, open: false },
  { code: "samcheok", lat: 37.45, open: false },
  { code: "hoengseong", lat: 37.49, open: false },
  { code: "yeongwol", lat: 37.18, open: false },
  { code: "jeongseon", lat: 37.38, open: false },
  { code: "cheorwon", lat: 38.15, open: false },
  { code: "hwacheon", lat: 38.11, open: false },
  { code: "yanggu", lat: 38.11, open: false },
  { code: "goseong", lat: 38.38, open: false },
  { code: "yangyang", lat: 38.08, open: false },
];

export const OPEN_REGION_CODES: OpenRegionCode[] = [
  "injae",
  "hongcheon",
  "pyeongchang",
];

export function isOpenRegion(code: RegionCode): code is OpenRegionCode {
  return OPEN_REGION_CODES.includes(code as OpenRegionCode);
}
