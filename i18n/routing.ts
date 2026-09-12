import { defineRouting } from "next-intl/routing";

/**
 * UI locales (PRD 2.3절 명확화 — 2주차 프론트 1차 검수에서 정정됨).
 * 한국어는 스코프 밖이 아니라 **기본 로케일**이다: design/artboards/ 31장 중 29장이 한국어
 * 화면이고, EN/中 토글은 한국어 위에 얹는 전환 옵션일 뿐이다. "영/중 2개"는 한국어를 뺀
 * 나머지 중 2개라는 뜻(PRD 2.3절 언어 상자). 심사위원이 배포 URL에 직접 접속하는 국내
 * 공모전이므로(11.5절) 기본 로케일이 한국어가 아니면 첫 화면부터 영어가 뜬다 — 1차 구현의
 * 실수를 반복하지 않도록 여기 남긴다.
 */
export const routing = defineRouting({
  locales: ["ko", "en", "zh"],
  defaultLocale: "ko",
  // 브라우저 Accept-Language로 "/"를 "/en" 등으로 리다이렉트하지 않는다 — 국내 공모전
  // 심사위원이 배포 URL에 직접 접속하므로(PRD 11.5절) 브라우저 언어와 무관하게 항상
  // 한국어가 먼저 뜨고, 전환은 LangSwitcher를 통한 명시적 선택으로만 이뤄진다.
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
