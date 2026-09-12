"use client";

import { useTranslations } from "next-intl";
import { CloudAlert, SearchX } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import type { ErrorCode } from "@/app/lib/types";

/**
 * 코스 생성 실패 화면 — 문구 변형 두 개로 통일 (PRD 6장, HANDOFF_LOG 2026-09-10 20:00).
 * NO_POI_DATA는 화면이 필요 없다(선택 자체가 비활성이라 도달 불가) — 여기선 다루지 않는다.
 */
export function GenerateErrorScreen({
  code,
  onRetry,
  onChangeConditions,
}: {
  code: Extract<ErrorCode, "NO_CANDIDATE" | "INTERNAL_ERROR">;
  onRetry: () => void;
  onChangeConditions: () => void;
}) {
  const t = useTranslations("result");

  const isNoCandidate = code === "NO_CANDIDATE";

  return (
    <div className="flex min-h-dvh flex-col">
      <Header showCareLink={false} />
      <div className="flex flex-grow flex-col justify-center px-5 pb-16 text-center md:mx-auto md:w-full md:max-w-md">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-danger-bg">
          {isNoCandidate ? (
            <SearchX size={26} className="text-danger" strokeWidth={1.6} />
          ) : (
            <CloudAlert size={26} className="text-danger" strokeWidth={1.6} />
          )}
        </span>
        <h1 className="mt-5 whitespace-pre-line text-2xl font-bold leading-snug tracking-tight">
          {isNoCandidate ? t("errorNoCandidateTitle") : t("errorServerTitle")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {isNoCandidate ? t("errorNoCandidateBody") : t("errorServerBody")}
        </p>
        <div className="mt-7">
          <Button onClick={isNoCandidate ? onChangeConditions : onRetry}>
            {isNoCandidate ? t("errorNoCandidateAction") : t("errorServerAction")}
          </Button>
        </div>
        <p className="mt-4 text-xs text-faint">
          {isNoCandidate ? t("errorNoCandidateHint") : t("errorServerHint")}
        </p>
      </div>
    </div>
  );
}
