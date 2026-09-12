import { defineRouting } from "next-intl/routing";

/**
 * UI locales (PRD 3장 확정): 서비스 기본 언어는 한국어이지만 "다국어 정밀 지도" Must-have 범위는
 * 영/중 2개만 실제 구현한다 (PRD 1장, 1.1절). 데이터 레이어(API 응답의 name/blurb/narration)는
 * ko/en/zh 세 언어를 항상 들고 있고, ko는 선택 언어 아래 병행 표기로만 쓰인다 — 별도 UI 로케일
 * 라우트는 만들지 않는다. design/artboards/Main.dc.html의 언어 토글도 EN/中 두 개뿐이다.
 */
export const routing = defineRouting({
  locales: ["en", "zh"],
  defaultLocale: "en",
});

export type AppLocale = (typeof routing.locales)[number];
