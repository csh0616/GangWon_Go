"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { pickName, type UiLocale } from "@/app/lib/localized";
import { formatDateRange } from "@/app/lib/date";
import { getSession, mockGoogleLogin } from "@/app/lib/auth";
import { saveItinerary } from "@/app/lib/api";
import { markPendingSave } from "@/app/lib/storage";
import type { GenerateResponseData, Relationship } from "@/app/lib/types";

type Step = "prompt" | "authorizing" | "retry";

export function SaveFlowModal({
  open,
  onClose,
  result,
  meta,
  onSaved,
  resumeMode,
}: {
  open: boolean;
  onClose: () => void;
  result: GenerateResponseData;
  meta: {
    start_date: string;
    end_date: string;
    companions: number;
    relationship: Relationship;
  };
  onSaved: (itineraryId: string) => void;
  /**
   * 실제 Google 로그인은 팝업이 아니라 전체 페이지 리다이렉트다(P0-C) — "계속하기"를 눌렀을
   * 때의 이 모달 인스턴스는 돌아왔을 때 이미 사라진 뒤라, 로그인 이후 저장을 이어가려면
   * 부모(app/[locale]/result/page.tsx)가 새로 연 모달에 "왜 열렸는지"를 알려줘야 한다.
   * "save": 이미 로그인된 상태로 돌아왔다 — 곧장 저장을 이어간다(로그인 화면을 다시 보여주지 않음).
   * "retry": Google 동의 화면에서 취소했거나 리다이렉트 자체가 실패했다 — 재시도 화면부터 보여준다.
   */
  resumeMode?: "save" | "retry";
}) {
  const t = useTranslations("save");
  const tc = useTranslations("common");
  const tr = useTranslations("regions");
  const trel = useTranslations("relationships");
  const locale = useLocale() as UiLocale;
  const [step, setStep] = useState<Step>(resumeMode === "retry" ? "retry" : "prompt");
  const [saving, setSaving] = useState(false);

  const title = result.selected_regions.region_codes.map((r) => tr(r)).join(" · ");
  const previewStops = result.itinerary_json.days.flatMap((d) => d.stops).slice(0, 3);
  const totalStops = result.itinerary_json.days.reduce((s, d) => s + d.stops.length, 0);

  async function completeSave() {
    setSaving(true);
    const saveRes = await saveItinerary({
      itinerary_json: result.itinerary_json,
      preference_weights: result.preference_weights,
      region_codes: result.selected_regions.region_codes,
      ...meta,
    });
    setSaving(false);
    if (saveRes.data) {
      onSaved(saveRes.data.itinerary_id);
    } else {
      // 저장 자체가 실패하면(드묾) 재시도 화면으로 되돌림 — 게스트 코스는 유지됨
      setStep("retry");
    }
  }

  useEffect(() => {
    if (open && resumeMode === "save" && getSession()) {
      // 리다이렉트로 돌아와 이미 로그인된 세션(외부 상태)을 반영하는 것이라 렌더 중 파생이 불가능하다.
      // completeSave는 매 렌더 새로 만들어지므로 deps에 넣지 않는다(무한 재실행 방지).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep("authorizing");
      void completeSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resumeMode]);

  async function handleGoogleContinue() {
    setStep("authorizing");
    // 리다이렉트로 페이지가 이동하기 전에 "저장을 이어가려 했다"는 사실을 남겨둔다 —
    // 돌아온 뒤 result 페이지가 이 값을 보고 로그인 화면 없이 곧장 저장을 재개한다.
    markPendingSave();
    const res = await mockGoogleLogin();
    if (!res.ok) {
      setStep("retry");
      return;
    }
    // 정상적인 리다이렉트 플로우라면 이 아래는 실행되지 않는다(페이지가 이미 이동했다) —
    // 리다이렉트 없이 세션이 즉시 생기는 예외적 경로를 위한 방어적 continuation일 뿐이다.
    await completeSave();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <div className="p-6">
        <div className="mb-5 rounded-2xl bg-bg-subtler p-4">
          <p className="text-[15px] font-bold tracking-tight">
            {result.selected_regions.region_codes.map((r) => tr(r)).join(" · ")}
          </p>
          <p className="mt-1 text-xs font-medium text-muted">
            {formatDateRange(meta.start_date, meta.end_date, locale)} · {meta.companions} · {trel(meta.relationship)}
          </p>
          <div className="mt-3 space-y-2.5">
            {previewStops.map((stop) => {
              const { primary } = pickName(stop.name, locale);
              return (
                <div key={stop.poi_id} className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-bg">
                    <CategoryIcon category={stop.category} size={15} />
                  </span>
                  <span className="text-[13px] font-semibold">{primary}</span>
                </div>
              );
            })}
          </div>
        </div>

        {step === "retry" ? (
          <RetryStep stops={totalStops} onRetry={handleGoogleContinue} onContinueWithoutSaving={onClose} />
        ) : (
          <>
            <h2 className="whitespace-pre-line text-xl font-bold leading-snug tracking-tight">
              {t("loginPromptTitle")}
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">{t("loginPromptBody")}</p>
            <p className="mt-3 text-xs leading-relaxed text-faint">
              {t.rich("loginPromptKeep", {
                course: title,
                b: (chunks) => <span className="font-semibold text-ink-soft">{chunks}</span>,
              })}
            </p>
            <div className="mt-6">
              <Button onClick={handleGoogleContinue} disabled={step === "authorizing" || saving}>
                {step === "authorizing" || saving ? tc("loading") : t("continueWithGoogle")}
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full py-2 text-center text-[13px] font-semibold text-muted"
              >
                {t("later")}
              </button>
            </div>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-faint">{t("loginTerms")}</p>
          </>
        )}
      </div>
    </Dialog>
  );
}

function RetryStep({
  stops,
  onRetry,
  onContinueWithoutSaving,
}: {
  stops: number;
  onRetry: () => void;
  onContinueWithoutSaving: () => void;
}) {
  const t = useTranslations("save");
  const tc = useTranslations("common");
  const tResult = useTranslations("result");

  return (
    <>
      <h2 className="whitespace-pre-line text-xl font-bold leading-snug tracking-tight">{t("retryTitle")}</h2>
      <p className="mt-2.5 text-sm leading-relaxed text-muted">{t("retryBody")}</p>
      <div className="mt-4 rounded-2xl bg-brand-bg px-4 py-3">
        <p className="text-[12.5px] font-bold text-brand-hover">{t("retryKeepTitle")}</p>
        <p className="mt-1 text-[12px] text-brand">{tResult("stops", { count: stops })}</p>
      </div>
      <div className="mt-6">
        <Button onClick={onRetry}>{tc("retry")}</Button>
        <button
          type="button"
          onClick={onContinueWithoutSaving}
          className="mt-3 w-full py-2 text-center text-[13px] font-semibold text-muted"
        >
          {t("retryContinueWithoutSaving")}
        </button>
      </div>
    </>
  );
}
