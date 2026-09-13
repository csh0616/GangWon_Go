import type { Localized } from "./types";

/** UI 로케일 (PRD 2.3절 명확화 — ko가 기본 로케일, en/zh은 전환 지원) */
export type UiLocale = "ko" | "en" | "zh";

/**
 * 장소 이름 전용 (API_CONTRACT.md "name" 절): 선택 언어를 주 표시값으로, 한국어 원문을 작게 병기한다.
 * 선택 언어 값이 null이면 한국어만 표시하고(병기 줄 없음) — 빈 줄을 남기지 않는다.
 * locale이 ko면 애초에 원문=표시값이라 병기 자체가 의미 없다 — secondary 없이 name.ko만 반환
 * (design/artboards/Main.dc.html 등 한국어 화면에 병기 줄이 없는 것과 동일).
 */
export function pickName(name: Localized, locale: UiLocale): { primary: string; secondary: string | null } {
  if (locale === "ko") {
    return { primary: name.ko ?? "", secondary: null };
  }
  const localizedValue = name[locale];
  if (localizedValue) {
    return { primary: localizedValue, secondary: name.ko };
  }
  return { primary: name.ko ?? "", secondary: null };
}

/**
 * blurb/narration/region_reason/alert message 전용: null이면 호출부가 그 줄 자체를 렌더링하지 않는다
 * (다른 언어로도 폴백하지 않음 — PRD 6장 "지어내지 않는다" 원칙과 동일선상, 여기선 "대체하지 않는다").
 */
export function localizedText(value: Localized | null | undefined, locale: UiLocale): string | null {
  if (!value) return null;
  return value[locale] ?? null;
}
