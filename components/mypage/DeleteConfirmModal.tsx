"use client";

import { useTranslations, useLocale } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { formatDateRange, diffDaysInclusive } from "@/app/lib/date";
import { buildResultTitle } from "@/app/lib/resultTitle";
import type { SavedItinerarySummary } from "@/app/lib/types";
import type { UiLocale } from "@/app/lib/localized";

export function DeleteConfirmModal({
  item,
  onCancel,
  onConfirm,
}: {
  item: SavedItinerarySummary;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("mypage");
  const tr = useTranslations("regions");
  const tResult = useTranslations("result");
  const locale = useLocale() as UiLocale;

  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <div className="p-6 text-center">
        <h2 className="text-lg font-bold tracking-tight">{t("deleteTitle")}</h2>
        <p className="mt-2 text-sm text-muted">{t("deleteBody")}</p>
        <div className="mt-4 rounded-2xl bg-bg-subtler p-3.5 text-left">
          <p className="text-[14px] font-bold">
            {buildResultTitle(
              item.region_codes,
              diffDaysInclusive(item.start_date, item.end_date),
              tr,
              tResult("titleSuffix")
            )}
          </p>
          <p className="mt-1 text-[12px] text-muted">
            {formatDateRange(item.start_date, item.end_date, locale)} · {tResult("stops", { count: item.stop_count })}
          </p>
        </div>
        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-bg-subtle py-3.5 text-[14.5px] font-bold text-ink-soft"
          >
            {t("deleteCancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-2xl bg-danger py-3.5 text-[14.5px] font-bold text-white"
          >
            {t("deleteConfirm")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
