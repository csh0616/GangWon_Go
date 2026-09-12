/**
 * 표시 전용 날짜 유틸. "YYYY-MM-DD" 문자열을 브라우저 로컬 타임존에 흔들리지 않게 UTC 기준으로
 * 파싱해서 포맷만 한다 — 서버가 이미 KST로 계산해 내려준 날짜를 프론트가 재계산하지 않는다는
 * 원칙(API_CONTRACT.md "days 배열 불변식") 그대로, 화면에 붙는 요일 표기도 문자열 그대로 신뢰한다.
 */
import type { UiLocale } from "./localized";

function parseYmd(ymd: string): { y: number; m: number; d: number; weekday: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, weekday };
}

const WEEKDAY_SHORT: Record<UiLocale, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  zh: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
};

const MONTH_SHORT: Record<UiLocale, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  zh: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
};

/** "9월 10일 목" 형태 */
export function formatMonthDayWeekday(ymd: string, locale: UiLocale): string {
  const { m, d, weekday } = parseYmd(ymd);
  if (locale === "zh") return `${MONTH_SHORT.zh[m - 1]}${d}日 ${WEEKDAY_SHORT.zh[weekday]}`;
  return `${MONTH_SHORT.en[m - 1]} ${d} (${WEEKDAY_SHORT.en[weekday]})`;
}

/** "9월 10일—12일" 형태 (같은 달 가정, 범위 표기) */
export function formatDateRange(startYmd: string, endYmd: string, locale: UiLocale): string {
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (locale === "zh") {
    if (start.m === end.m) return `${MONTH_SHORT.zh[start.m - 1]}${start.d}日—${end.d}日`;
    return `${MONTH_SHORT.zh[start.m - 1]}${start.d}日—${MONTH_SHORT.zh[end.m - 1]}${end.d}日`;
  }
  if (start.m === end.m) return `${MONTH_SHORT.en[start.m - 1]} ${start.d}–${end.d}`;
  return `${MONTH_SHORT.en[start.m - 1]} ${start.d} – ${MONTH_SHORT.en[end.m - 1]} ${end.d}`;
}

/** "2026. 09. 10" 형태 (입력 필드 표시용) */
export function formatDots(ymd: string): string {
  const { y, m, d } = parseYmd(ymd);
  return `${y}. ${String(m).padStart(2, "0")}. ${String(d).padStart(2, "0")}`;
}

export function diffDaysInclusive(start: string, end: string): number {
  const a = parseYmd(start);
  const b = parseYmd(end);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000) + 1;
}

export function addDays(ymd: string, n: number): string {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d) + n * 86_400_000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function daysUntil(ymd: string): number {
  return diffDaysInclusive(todayYmd(), ymd) - 1;
}

/**
 * "오늘"은 뷰어의 브라우저 타임존이 아니라 KST(Asia/Seoul) 기준이어야 한다 (PRD 6장 확정 사항 —
 * 서버 판정과 동일 기준을 프론트도 따라야 진행중/지난 여행 구분이 어긋나지 않는다). 서버 배포
 * 타임존(UTC)과 달리 브라우저는 뷰어마다 제각각이므로 Intl로 KST 날짜를 직접 뽑는다.
 */
export function todayYmd(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}
