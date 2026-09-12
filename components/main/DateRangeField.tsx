"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { ChevronDown } from "lucide-react";
import { formatDots, formatMonthDayWeekday, diffDaysInclusive, todayYmd } from "@/app/lib/date";
import type { UiLocale } from "@/app/lib/localized";

function DateBox({ value, onChange, min }: { value: string; onChange: (v: string) => void; min?: string }) {
  return (
    <div className="relative flex h-14 flex-grow items-center justify-between rounded-2xl bg-bg-subtle px-4">
      <span className="text-base font-bold tracking-tight">{formatDots(value)}</span>
      <ChevronDown size={13} className="text-muted" strokeWidth={2} />
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label="date"
      />
    </div>
  );
}

export function DateRangeField({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}) {
  const t = useTranslations("main");
  const locale = useLocale() as UiLocale;
  const days = diffDaysInclusive(startDate, endDate);

  return (
    <div>
      <div className="flex items-center gap-2">
        <DateBox
          value={startDate}
          min={todayYmd()}
          onChange={(v) => onChange(v, v > endDate ? v : endDate)}
        />
        <span className="text-sm text-disabled">—</span>
        <DateBox value={endDate} min={startDate} onChange={(v) => onChange(startDate, v)} />
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <span className="rounded-full bg-brand-bg px-[9px] py-1 text-[11px] font-bold text-brand">
          {t("dateDaysTag", { count: days })}
        </span>
        <span className="text-[12.5px] font-medium text-muted">
          {t("dateStartsFrom", { date: formatMonthDayWeekday(startDate, locale) })}
        </span>
      </div>
    </div>
  );
}
