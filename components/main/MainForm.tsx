"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { RegionPicker } from "./RegionPicker";
import { DateRangeField } from "./DateRangeField";
import { CompanionsStepper } from "./CompanionsStepper";
import { RelationshipPicker } from "./RelationshipPicker";
import { diffDaysInclusive, addDays, todayYmd } from "@/app/lib/date";
import { savePendingRequest } from "@/app/lib/storage";
import type { GenerateRequest, OpenRegionCode, Relationship } from "@/app/lib/types";
import type { UiLocale } from "@/app/lib/localized";

export function MainForm() {
  const t = useTranslations("main");
  const locale = useLocale() as UiLocale;
  const router = useRouter();

  const [freeText, setFreeText] = useState("");
  const [autoMode, setAutoMode] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<OpenRegionCode[]>([]);
  const [startDate, setStartDate] = useState(() => addDays(todayYmd(), 1));
  const [endDate, setEndDate] = useState(() => addDays(todayYmd(), 3));
  const [companions, setCompanions] = useState(2);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const freeTextEmpty = freeText.trim().length === 0;
  // 자유 텍스트를 지우면 "어디든지" 선택은 더 이상 유효하지 않다 (PRD 3.5절 2.4단계 각주)
  const effectiveAutoMode = autoMode && !freeTextEmpty;
  const dayCount = diffDaysInclusive(startDate, endDate);
  const regionMissing = !effectiveAutoMode && selectedRegions.length === 0;
  const relationshipMissing = relationship === null;
  const tooMany = !effectiveAutoMode && selectedRegions.length > dayCount;
  const requiredMissingCount = (regionMissing ? 1 : 0) + (relationshipMissing ? 1 : 0);
  const canSubmit = requiredMissingCount === 0 && !tooMany;

  const missingLabels = useMemo(() => {
    const labels: string[] = [];
    if (regionMissing) labels.push(t("regionLabel"));
    if (relationshipMissing) labels.push(t("relationshipLabel"));
    return labels;
  }, [regionMissing, relationshipMissing, t]);

  function handleSelectAuto() {
    if (freeTextEmpty) return;
    setAutoMode(true);
    setSelectedRegions([]);
  }

  function handleToggleRegion(code: OpenRegionCode) {
    setAutoMode(false);
    setSelectedRegions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function handleSubmit() {
    if (!canSubmit) {
      setSubmitAttempted(true);
      return;
    }

    const request: GenerateRequest = {
      start_date: startDate,
      end_date: endDate,
      companions,
      relationship: relationship as Relationship,
      free_text: freeText.trim(),
      region_codes: effectiveAutoMode ? [] : selectedRegions,
      lang: locale,
    };
    savePendingRequest(request);
    router.push("/result");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {submitAttempted && requiredMissingCount > 0 && (
        <div className="flex items-center gap-2 bg-danger-bg px-5 py-3">
          <AlertCircle size={15} className="shrink-0 text-danger" strokeWidth={1.6} />
          <span className="text-[12.5px] font-semibold text-danger">
            {t("requiredBannerPrefix")} {missingLabels.join(", ")}
          </span>
        </div>
      )}

      <div className="px-5 pt-3.5 md:mx-auto md:w-full md:max-w-2xl md:px-0 md:pt-10">
        <h1 className="whitespace-pre-line text-[27px] font-bold leading-[1.42] tracking-tight md:text-4xl">
          {t("heroTitle")}
        </h1>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
          {t("heroSubtitle")}
        </p>
      </div>

      <div className="mx-auto w-full md:max-w-2xl md:px-0">
        <Section label={t("freeTextLabel")} hint={t("freeTextOptional")}>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={t("freeTextPlaceholder")}
            rows={3}
            className="min-h-[104px] w-full resize-none rounded-2xl bg-bg-subtle p-4 text-[15px] font-medium leading-relaxed text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{t("freeTextHint")}</p>
        </Section>

        <Section
          label={t("regionLabel")}
          hint={
            submitAttempted && regionMissing
              ? t("regionHintRequired")
              : submitAttempted && tooMany
                ? t("regionHintTooMany", { count: selectedRegions.length })
                : t("regionHintDefault")
          }
          hintTone={submitAttempted && (regionMissing || tooMany) ? "danger" : "default"}
        >
          <RegionPicker
            autoMode={effectiveAutoMode}
            selected={selectedRegions}
            freeTextEmpty={freeTextEmpty}
            onSelectAuto={handleSelectAuto}
            onToggleRegion={handleToggleRegion}
          />
        </Section>

        <Section label={t("dateLabel")} hint={t("dateHint")}>
          <DateRangeField
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
          />
        </Section>

        <Section label={t("companionsLabel")}>
          <CompanionsStepper value={companions} onChange={setCompanions} />
        </Section>

        <Section
          label={t("relationshipLabel")}
          hint={submitAttempted && relationshipMissing ? t("relationshipHintRequired") : undefined}
          hintTone="danger"
        >
          <RelationshipPicker value={relationship} onChange={setRelationship} />
        </Section>
      </div>

      <div className="flex-grow" />

      <div className="sticky bottom-0 border-t border-bg-subtle bg-bg px-5 pb-6 pt-3 shadow-[0_-4px_16px_rgba(25,31,40,.05)] md:mx-auto md:w-full md:max-w-2xl md:border-none md:px-0 md:shadow-none">
        <div className="flex items-center gap-1.5 pb-3">
          {tooMany ? (
            <>
              <AlertCircle size={15} className="text-muted" strokeWidth={1.6} />
              <span className="text-[12.5px] font-semibold text-muted">
                {t("regionHintTooMany", { count: selectedRegions.length })}
              </span>
            </>
          ) : requiredMissingCount > 0 ? (
            <>
              <AlertCircle size={15} className="text-muted" strokeWidth={1.6} />
              <span className="text-[12.5px] font-semibold text-muted">
                {t("checklistIncomplete", { count: requiredMissingCount })}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 size={15} className="text-brand" strokeWidth={1.6} />
              <span className="text-[12.5px] font-semibold text-ink-soft">
                {t("checklistComplete")}
              </span>
            </>
          )}
        </div>
        <Button onClick={handleSubmit} visuallyEmpty={!canSubmit}>
          {t("submit")}
        </Button>
      </div>
    </div>
  );
}

function Section({
  label,
  hint,
  hintTone = "default",
  children,
}: {
  label: string;
  hint?: string;
  hintTone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 pt-[30px] md:px-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold tracking-tight">{label}</span>
        {hint && (
          <span
            className={
              hintTone === "danger" ? "text-right text-xs font-semibold text-danger" : "text-right text-xs font-medium text-muted"
            }
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
