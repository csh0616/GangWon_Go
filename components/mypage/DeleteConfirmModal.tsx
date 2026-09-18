"use client";

import { useTranslations, useLocale } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { formatDateRange, diffDaysInclusive } from "@/app/lib/date";
import { buildResultTitle } from "@/app/lib/resultTitle";
import type { SavedItinerarySummary } from "@/app/lib/types";
import type { UiLocale } from "@/app/lib/localized";

export function DeleteConfirmModal({
  item,
  deleting = false,
  error = false,
  onCancel,
  onConfirm,
}: {
  item: SavedItinerarySummary;
  deleting?: boolean;
  /** 삭제 요청이 실패했을 때(오프라인 등) — 목록에서 지우지 않고 여기서 재시도하게 한다(리포트 05) */
  error?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("mypage");
  const tc = useTranslations("common");
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
        {error && <p className="mt-3 text-[12.5px] font-semibold text-danger">{t("deleteError")}</p>}
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
            disabled={deleting}
            className="flex-1 rounded-2xl bg-danger py-3.5 text-[14.5px] font-bold text-white disabled:opacity-60"
          >
            {deleting ? tc("loading") : error ? tc("retry") : t("deleteConfirm")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
