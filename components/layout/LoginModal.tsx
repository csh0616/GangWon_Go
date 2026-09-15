"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { mockGoogleLogin } from "@/app/lib/auth";

type Step = "prompt" | "authorizing" | "retry";

/**
 * 홈 배너("다시 로그인하면...")에서 쓰는 저장 맥락 없는 단독 로그인 모달.
 * design/artboards/Login.dc.html 기본 문구 사용 — 저장 버튼 흐름(SaveFlowModal)의
 * "코스를 저장하려면 로그인이 필요해요" 문구/코스 미리보기와는 다르다.
 */
export function LoginModal({
  open,
  onClose,
  onLoggedIn,
}: {
  open: boolean;
  onClose: () => void;
  onLoggedIn: () => void;
}) {
  const t = useTranslations("save");
  const tc = useTranslations("common");
  const [step, setStep] = useState<Step>("prompt");

  async function handleGoogleContinue() {
    setStep("authorizing");
    const res = await mockGoogleLogin();
    if (!res.ok) {
      setStep("retry");
      return;
    }
    onLoggedIn();
  }

  function handleOpenChange(next: boolean) {
    if (next) return;
    onClose();
    // 다음에 다시 열렸을 때 항상 처음(prompt) 단계부터 보이도록 리셋
    setStep("prompt");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="p-6">
        {step === "retry" ? (
          <>
            <h2 className="whitespace-pre-line text-xl font-bold leading-snug tracking-tight">
              {t("retryTitle")}
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">{t("retryBody")}</p>
            <div className="mt-6">
              <Button onClick={handleGoogleContinue}>{tc("retry")}</Button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full py-2 text-center text-[13px] font-semibold text-muted"
              >
                {tc("cancel")}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="whitespace-pre-line text-xl font-bold leading-snug tracking-tight">
              {t("loginTitle")}
            </h2>
            <p className="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-muted">
              {t("loginSubtitle")}
            </p>
            <div className="mt-6">
              <Button onClick={handleGoogleContinue} disabled={step === "authorizing"}>
                {step === "authorizing" ? tc("loading") : t("continueWithGoogle")}
              </Button>
              <p className="mt-3 text-center text-[11.5px] leading-relaxed text-faint">
                {t("loginPopupHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full py-2 text-center text-[13px] font-semibold text-muted"
            >
              {t("later")}
            </button>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-faint">{t("loginTerms")}</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
