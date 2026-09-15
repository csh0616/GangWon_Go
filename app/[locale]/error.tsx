"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * [locale] 세그먼트 에러 바운더리 (P0-B, HANDOFF_LOG 배포본 1차 점검 —
 * "예외 하나가 페이지 전체를 죽인다"). 심사위원이 안내 없이 배포 URL에 직접 접속하므로
 * (PRD 11.5절), 렌더 중 예외가 흰 화면이 아니라 이 화면으로 떨어져야 한다.
 *
 * 부모 레이아웃(app/[locale]/layout.tsx)이 계속 렌더된 채로 유지되므로 NextIntlClientProvider가
 * 이미 살아 있다 — useTranslations를 그대로 쓸 수 있다(app/global-error.tsx는 다르다, 그 파일 주석 참고).
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-danger-bg">
        <AlertTriangle size={26} className="text-danger" strokeWidth={1.6} />
      </span>
      <h1 className="text-xl font-bold tracking-tight">{t("errorBoundaryTitle")}</h1>
      <p className="max-w-xs text-sm leading-relaxed text-muted">{t("errorBoundaryBody")}</p>
      <div className="w-full max-w-xs">
        <Button onClick={reset}>{t("retry")}</Button>
      </div>
    </div>
  );
}
