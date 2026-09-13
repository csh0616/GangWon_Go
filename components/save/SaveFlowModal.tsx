"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { pickName, type UiLocale } from "@/app/lib/localized";
import { formatDateRange } from "@/app/lib/date";
import { mockGoogleLogin } from "@/app/lib/mock/auth";
import { saveItinerary } from "@/app/lib/api";
import type { GenerateResponseData, Relationship } from "@/app/lib/types";

type Step = "prompt" | "authorizing" | "retry";

export function SaveFlowModal({
  open,
  onClose,
  result,
  meta,
  onSaved,
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
}) {
  const t = useTranslations("save");
  const tc = useTranslations("common");
  const tr = useTranslations("regions");
  const trel = useTranslations("relationships");
  const locale = useLocale() as UiLocale;
  const [step, setStep] = useState<Step>("prompt");
  const [saving, setSaving] = useState(false);

  const title = result.selected_regions.region_codes.map((r) => tr(r)).join(" · ");
  const previewStops = result.itinerary_json.days.flatMap((d) => d.stops).slice(0, 3);
  const totalStops = result.itinerary_json.days.reduce((s, d) => s + d.stops.length, 0);

  async function handleGoogleContinue() {
    setStep("authorizing");
    const res = await mockGoogleLogin();
    if (!res.ok) {
      setStep("retry");
      return;
    }
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
