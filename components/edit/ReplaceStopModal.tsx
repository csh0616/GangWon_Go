"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { pickName, localizedText, type UiLocale } from "@/app/lib/localized";
import { formatMonthDayWeekday } from "@/app/lib/date";
import { regenerateStop, confirmStopReplacement } from "@/app/lib/api";
import type { RegenerateCandidate, RegionCode, Stop } from "@/app/lib/types";

export function ReplaceStopModal({
  open,
  onClose,
  itineraryId,
  day,
  date,
  ordinal,
  targetStop,
  region,
  excludePoiIds,
  onConfirmed,
}: {
  open: boolean;
  onClose: () => void;
  itineraryId: string;
  day: number;
  date: string;
  ordinal: number;
  targetStop: Stop;
  region: RegionCode;
  excludePoiIds: string[];
  onConfirmed: (newPoiId: string) => void;
}) {
  const t = useTranslations("edit");
  const tc = useTranslations("categories");
  const locale = useLocale() as UiLocale;
  const [freeText, setFreeText] = useState("");
  const [candidates, setCandidates] = useState<RegenerateCandidate[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleRecommend() {
    setLoading(true);
    setSelected(null);
    const res = await regenerateStop(itineraryId, day, targetStop.poi_id, region, excludePoiIds, freeText);
    setLoading(false);
    if (res.data) setCandidates(res.data.candidates);
  }

  async function handleConfirm() {
    if (!selected) return;
    setConfirming(true);
    const res = await confirmStopReplacement(itineraryId, day, targetStop.poi_id, selected);
    setConfirming(false);
    if (res.data) onConfirmed(selected);
  }

  const targetName = pickName(targetStop.name, locale).primary;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <div className="p-6">
        <h2 className="text-lg font-bold tracking-tight">{t("title")}</h2>
        <p className="mt-1 text-[12.5px] font-medium text-muted">
          {t("dayMeta", { day, date: formatMonthDayWeekday(date, locale), ordinal })}
        </p>

        <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-bg-subtler p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-bg">
            <CategoryIcon category={targetStop.category} size={17} />
          </span>
          <span>
            <p className="text-[14px] font-semibold">{targetName}</p>
            <p className="text-[11.5px] text-muted">{tc(targetStop.category)}</p>
          </span>
        </div>

        <p className="mb-2 mt-5 text-[13px] font-bold">{t("whatToReplaceWith")}</p>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder={t("textareaPlaceholder")}
          rows={2}
          className="w-full resize-none rounded-2xl bg-bg-subtle p-3.5 text-[13.5px] leading-relaxed placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <p className="mt-1.5 text-[11.5px] text-muted">{t("textareaHint")}</p>

        <button
          type="button"
          onClick={handleRecommend}
          disabled={loading}
          className="mt-3 w-full rounded-2xl bg-bg-subtle py-3 text-[13.5px] font-bold text-ink-soft disabled:opacity-60"
        >
          {t("recommendAgain")}
        </button>

        {candidates && (
          <div className="mt-5">
            <p className="mb-2.5 text-[13px] font-bold">
              {t("candidatesTitle")} · {t("candidatesCount", { count: candidates.length })}
            </p>
            {candidates.length === 0 ? (
              <p className="rounded-xl bg-bg-subtler p-3 text-[12.5px] text-muted">{t("noCandidates")}</p>
            ) : (
              <div className="space-y-2">
                {candidates.map((c) => {
                  const { primary } = pickName(c.name, locale);
                  const blurb = localizedText(c.blurb, locale);
                  const isSelected = selected === c.poi_id;
                  return (
                    <button
                      key={c.poi_id}
                      type="button"
                      onClick={() => setSelected(c.poi_id)}
                      className={
                        "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors " +
                        (isSelected ? "border-brand bg-brand-bg" : "border-transparent bg-bg-subtler")
                      }
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-bg">
                        <CategoryIcon category={c.category} size={17} />
                      </span>
                      <span className="min-w-0 flex-grow">
                        <p className="text-[14px] font-semibold">{primary}</p>
                        <p className="text-[11.5px] text-muted">
                          {tc(c.category)}
                          {blurb && <span> · {blurb}</span>}
                        </p>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <p className="mt-5 text-center text-[11.5px] leading-relaxed text-faint">{t("footnote")}</p>
        <div className="mt-3">
          <Button onClick={handleConfirm} disabled={!selected || confirming}>
            {t("confirm")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
