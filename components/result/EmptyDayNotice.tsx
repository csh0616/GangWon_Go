"use client";

import { useTranslations, useLocale } from "next-intl";
import { CalendarX } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { formatMonthDayWeekday } from "@/app/lib/date";
import type { RegionCode } from "@/app/lib/types";
import type { UiLocale } from "@/app/lib/localized";

/** 빈 날(stops: []) 전용 안내 — NO_CANDIDATE 전면 에러와는 다른 상태 (TEST_PLAN.md T-025) */
export function EmptyDayNotice({ region, date }: { region: RegionCode; date: string }) {
  const t = useTranslations("result");
  const tr = useTranslations("regions");
  const locale = useLocale() as UiLocale;
  const router = useRouter();

  return (
    <div className="my-2 rounded-2xl bg-bg-subtler p-4">
      <div className="flex items-start gap-2.5">
        <CalendarX size={17} className="mt-0.5 shrink-0 text-muted" strokeWidth={1.6} />
        <div>
          <p className="text-[13.5px] font-bold tracking-tight">{t("emptyDayTitle")}</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            {t("emptyDayBody", { region: tr(region), date: formatMonthDayWeekday(date, locale) })}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex-1 rounded-xl bg-bg py-2.5 text-[12.5px] font-semibold text-ink-soft"
        >
          {t("emptyDayAction1")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex-1 rounded-xl bg-bg py-2.5 text-[12.5px] font-semibold text-ink-soft"
        >
          {t("emptyDayAction2")}
        </button>
      </div>
    </div>
  );
}
