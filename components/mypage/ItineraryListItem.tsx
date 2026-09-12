"use client";

import { useTranslations, useLocale } from "next-intl";
import { Trash2 } from "lucide-react";
import { formatDateRange, daysUntil, diffDaysInclusive, todayYmd } from "@/app/lib/date";
import { buildResultTitle } from "@/app/lib/resultTitle";
import type { SavedItinerarySummary } from "@/app/lib/types";
import type { UiLocale } from "@/app/lib/localized";

export function ItineraryListItem({
  item,
  onOpen,
  onDelete,
}: {
  item: SavedItinerarySummary;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("result");
  const tmy = useTranslations("mypage");
  const tr = useTranslations("regions");
  const locale = useLocale() as UiLocale;

  const today = todayYmd();
  const isOngoing = item.start_date <= today && today <= item.end_date;
  const dUntil = daysUntil(item.start_date);

  return (
    <div className="flex items-center gap-3 py-3">
      <button type="button" onClick={onOpen} className="min-w-0 flex-grow text-left">
        <p className="truncate text-[15px] font-bold tracking-tight">
          {buildResultTitle(
            item.region_codes,
            diffDaysInclusive(item.start_date, item.end_date),
            tr,
            t("titleSuffix")
          )}
        </p>
        <p className="mt-1 text-[12.5px] font-medium text-muted">
          {formatDateRange(item.start_date, item.end_date, locale)} · {t("stops", { count: item.stop_count })}
        </p>
      </button>
      {isOngoing && (
        <span className="shrink-0 rounded-full bg-brand-bg px-2.5 py-1 text-[11px] font-bold text-brand">
          {tmy("watchingStatus")}
        </span>
      )}
      {!isOngoing && dUntil >= 0 && (
        <span className="shrink-0 rounded-full bg-bg-subtle px-2.5 py-1 text-[11px] font-bold text-ink-soft">
          D-{dUntil}
        </span>
      )}
      <button
        type="button"
        onClick={onDelete}
        aria-label={tmy("deleteConfirm")}
        className="shrink-0 rounded-full p-2 text-faint hover:bg-bg-subtle hover:text-danger"
      >
        <Trash2 size={16} strokeWidth={1.6} />
      </button>
    </div>
  );
}
