"use client";

import { useEffect } from "react";

/**
 * 루트 레이아웃(app/[locale]/layout.tsx — 이 저장소엔 별도 app/layout.tsx가 없고 [locale]
 * 세그먼트가 사실상 루트 레이아웃이다) 자체가 렌더 중 예외를 던질 때만 여기로 떨어진다.
 * 이 경우 NextIntlClientProvider를 포함한 그 레이아웃 전체가 대체되므로 next-intl 컨텍스트가
 * 없다 — useTranslations를 쓸 수 없어 문구를 하드코딩한다. <html>/<body>도 이 파일이 직접
 * 그려야 한다(Next.js 요구사항 — global-error는 루트 레이아웃을 완전히 대체한다).
 *
 * 극히 드문 최후 방어선이라 외부 CSS(globals.css)나 폰트에 기대지 않고 인라인 스타일만 쓴다 —
 * 그 의존성 자체가 깨져서 여기 떨어졌을 가능성을 배제할 수 없기 때문이다.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100dvh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#191F28" }}>
            잠시 문제가 생겼어요
          </h1>
          <p style={{ fontSize: 14, color: "#8B95A1", maxWidth: 320, margin: 0, lineHeight: 1.6 }}>
            페이지를 표시하는 중 문제가 발생했어요. 다시 시도해주세요.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              height: 48,
              padding: "0 24px",
              borderRadius: 12,
              background: "#0B7A55",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 15,
              border: "none",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
