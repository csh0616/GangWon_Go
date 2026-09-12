import type { Localized } from "./types";

/** UI 로케일만 받는다 (ko는 병행 표기 전용, 별도 UI 로케일이 아님 — i18n/routing.ts 주석 참고) */
export type UiLocale = "en" | "zh";

/**
 * 장소 이름 전용 (API_CONTRACT.md "name" 절): 선택 언어를 주 표시값으로, 한국어 원문을 작게 병기한다.
 * 선택 언어 값이 null이면 한국어만 표시하고(병기 줄 없음) — 빈 줄을 남기지 않는다.
 */
export function pickName(name: Localized, locale: UiLocale): { primary: string; secondary: string | null } {
  const localizedValue = name[locale];
  if (localizedValue) {
    return { primary: localizedValue, secondary: name.ko };
  }
  return { primary: name.ko ?? "", secondary: null };
}

/**
 * blurb/narration/region_reason/alert message 전용: null이면 호출부가 그 줄 자체를 렌더링하지 않는다
 * (한국어로도 폴백하지 않음 — PRD 6장 "지어내지 않는다" 원칙과 동일선상, 여기선 "대체하지 않는다").
 */
export function localizedText(value: Localized | null | undefined, locale: UiLocale): string | null {
  if (!value) return null;
  return value[locale] ?? null;
}
