"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { ChevronDown } from "lucide-react";
import { formatDots, formatMonthDayWeekday, diffDaysInclusive, todayYmd, addDays } from "@/app/lib/date";
import type { UiLocale } from "@/app/lib/localized";

export const MAX_TRIP_DAYS = 10;

function DateBox({
  value,
  onChange,
  min,
  max,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  ariaLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    try {
      // showPicker()는 크롬 99+/엣지/사파리 16+ 지원. 없거나 던지면 focus로 폴백해
      // 최소한 키보드로라도 값을 바꿀 수 있게 한다.
      if (typeof el.showPicker !== "function") throw new Error("showPicker unsupported");
      el.showPicker();
    } catch {
      el.focus();
    }
  }

  return (
    <div className="relative flex h-14 flex-grow items-center justify-between rounded-2xl bg-bg-subtle px-4">
      <span className="text-base font-bold tracking-tight">{formatDots(value)}</span>
      <ChevronDown size={13} className="text-muted" strokeWidth={2} />
      {/* 네이티브 date input — 값 보관 + showPicker() 대상일 뿐, 직접 클릭/포커스 대상은 아니다 */}
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
      {/* 실제 클릭/키보드 대상. 데스크톱 크롬은 type=date 입력의 달력 아이콘을 정확히 눌러야만
          피커가 열리는데, 그 아이콘이 투명 입력 위라 보이지도 클릭되지도 않았다 — 박스 전체를
          덮는 버튼이 showPicker()를 직접 호출해 어디를 눌러도 열리게 한다. */}
      <button
        type="button"
        onClick={openPicker}
        aria-label={ariaLabel}
        className="absolute inset-0 h-full w-full rounded-2xl bg-transparent transition-colors hover:bg-ink/[0.04] focus:outline-none focus-visible:bg-ink/[0.04] focus-visible:ring-2 focus-visible:ring-brand/50"
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
  const endMax = addDays(startDate, MAX_TRIP_DAYS - 1);

  function handleStartChange(v: string) {
    let newEnd = endDate;
    if (v > endDate) {
      // 시작일이 종료일보다 뒤로 가면 종료일도 같이 따라간다 (기존 동작 유지)
      newEnd = v;
    } else if (diffDaysInclusive(v, endDate) > MAX_TRIP_DAYS) {
      // 최대 10일을 넘기면 종료일을 10일째로 당겨준다
      newEnd = addDays(v, MAX_TRIP_DAYS - 1);
    }
    onChange(v, newEnd);
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <DateBox
          value={startDate}
          min={todayYmd()}
          onChange={handleStartChange}
          ariaLabel={t("dateStartLabel")}
        />
        <span className="text-sm text-disabled">—</span>
        <DateBox
          value={endDate}
          min={startDate}
          max={endMax}
          onChange={(v) => onChange(startDate, v)}
          ariaLabel={t("dateEndLabel")}
        />
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
