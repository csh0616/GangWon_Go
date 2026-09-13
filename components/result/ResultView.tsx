"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Clock3, MapPin, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StopRow } from "./StopRow";
import { TravelLeg } from "./TravelLeg";
import { RegionTravelBanner } from "./RegionTravelBanner";
import { EmptyDayNotice } from "./EmptyDayNotice";
import { PrefChips } from "./PrefChips";
import { MapView } from "./MapView";
import { localizedText, type UiLocale } from "@/app/lib/localized";
import { formatDateRange, formatMonthDayWeekday, diffDaysInclusive, todayYmd } from "@/app/lib/date";
import { buildResultTitle } from "@/app/lib/resultTitle";
import type {
  ItineraryJson,
  PreferenceWeights,
  RegionCode,
  Relationship,
  SelectedRegions,
} from "@/app/lib/types";

export type SavedStatus = "unsaved" | "saved" | "watching";

export type ResultViewProps = {
  itineraryJson: ItineraryJson;
  selectedRegions: SelectedRegions;
  preferenceWeights: PreferenceWeights;
  startDate: string;
  endDate: string;
  companions: number;
  relationship: Relationship;
  status: SavedStatus;
  editable?: boolean;
  onSave?: () => void;
  onSwapStop?: (day: number, poiId: string, region: RegionCode) => void;
  changedStopId?: string | null;
};

export function ResultView({
  itineraryJson,
  selectedRegions,
  preferenceWeights,
  startDate,
  endDate,
  companions,
  relationship,
  status,
  editable = false,
  onSave,
  onSwapStop,
  changedStopId,
}: ResultViewProps) {
  const t = useTranslations("result");
  const tc = useTranslations("common");
  const tr = useTranslations("regions");
  const trel = useTranslations("relationships");
  const locale = useLocale() as UiLocale;
  const [expanded, setExpanded] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [hasMyLocation, setHasMyLocation] = useState(false);

  const { days, narration, region_reason } = itineraryJson;
  const dayCount = days.length;
  const activeDay = days[selectedDayIndex] ?? days[0];
  const stopCount = days.reduce((sum, d) => sum + d.stops.length, 0);
  const title = buildResultTitle(selectedRegions.region_codes, dayCount, tr, t("titleSuffix"));
  const narrationText = localizedText(narration, locale);
  const regionReasonText = localizedText(region_reason, locale);
  const today = todayYmd();

  const daysContent = (
    <>
      {days.map((day, dayIndex) => (
        <div key={day.day}>
          <button
            type="button"
            onClick={() => setSelectedDayIndex(dayIndex)}
            className="flex w-full items-baseline gap-2.5 pb-1.5 pt-[18px] text-left first:pt-0"
          >
            <span
              className={
                "text-[17px] font-bold tracking-tight md:text-[18px] " +
                (dayIndex === selectedDayIndex ? "text-brand" : "")
              }
            >
              {t("day", { n: day.day })}
            </span>
            {status !== "unsaved" && day.date === today && (
              <span className="rounded-full bg-brand-bg px-2 py-0.5 text-[11px] font-bold text-brand">
                {t("today")}
              </span>
            )}
            <span className="text-[12.5px] font-medium text-muted md:text-[13px]">
              {tr(day.region_code)} · {formatMonthDayWeekday(day.date, locale)} · {t("dayStopCount", { count: day.stops.length })}
            </span>
          </button>

          <RegionTravelBanner travel={day.travel_from_prev_day} />

          {day.stops.length === 0 ? (
            <EmptyDayNotice region={day.region_code} date={day.date} />
          ) : (
            day.stops.map((stop, i) => (
              <div key={stop.poi_id}>
                {i > 0 && <TravelLeg travel={stop.travel_from_prev} />}
                <StopRow
                  stop={stop}
                  changed={changedStopId === stop.poi_id}
                  editable={editable}
                  onSwap={() => onSwapStop?.(day.day, stop.poi_id, day.region_code)}
                />
              </div>
            ))
          )}
        </div>
      ))}
    </>
  );

  const metaChips = (
    <div className="flex flex-wrap gap-1.5 md:gap-2">
      <MetaChip>{formatDateRange(startDate, endDate, locale)}</MetaChip>
      <MetaChip>{companions}</MetaChip>
      <MetaChip>{trel(relationship)}</MetaChip>
      <MetaChip className="hidden md:flex">{t("stops", { count: stopCount })}</MetaChip>
      <span className="flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full bg-bg-subtle px-2.5 text-[12.5px] font-bold text-ink-soft md:h-8 md:px-[11px] md:text-[13px]">
        <Clock3 size={12} className="text-muted" strokeWidth={1.4} />
        {status === "unsaved" ? t("notSaved") : status === "watching" ? t("watching") : t("saved")}
      </span>
    </div>
  );

  const header = (
    <div>
      <h1 className="text-2xl font-bold tracking-tight md:text-[30px]">{title}</h1>
      <div className="mt-2.5 md:mt-3.5">{metaChips}</div>
      {regionReasonText && (
        <div className="mt-3 flex items-start gap-2">
          <MapPin size={14} className="mt-0.5 shrink-0 text-brand" strokeWidth={1.6} />
          <span className="text-[12.5px] font-semibold leading-relaxed text-brand-hover">
            {regionReasonText}
          </span>
        </div>
      )}
      {narrationText && (
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft md:text-[14.5px]">
          {narrationText}
        </p>
      )}
      <PrefChips weights={preferenceWeights} />
    </div>
  );

  const footer = status === "unsaved" && onSave ? (
    <div className="border-t-0 bg-bg px-5 pb-6 pt-3 md:px-8 md:pb-6 md:pt-3.5">
      <p className="mb-3 hidden text-[12.5px] text-muted md:block">{t("saveHint")}</p>
      <Button onClick={onSave}>{t("saveButton")}</Button>
    </div>
  ) : status === "watching" ? (
    <div className="border-t border-bg-subtle px-5 py-4 md:px-8">
      <p className="text-[12.5px] font-semibold text-ink-soft">{t("watchingTitle")}</p>
      <p className="mt-0.5 text-[12px] text-muted">{t("watchingSubtitle")}</p>
    </div>
  ) : null;

  return (
    <div className="relative h-[calc(100dvh-56px)] overflow-hidden md:h-[calc(100dvh-64px)]">
      {/* 지도 (모바일: 배경 전체 / 데스크톱: 우측 패널) */}
      <div className="absolute inset-0 md:left-[480px]">
        <MapView day={activeDay} onMyLocationChange={setHasMyLocation} />
      </div>

      {/* DAY 전환 — 지도가 어느 날짜를 보여주는지 표시하고 좌우로 넘길 수 있다 */}
      {dayCount > 1 && (
        <div className="absolute left-6 top-6 flex items-center gap-1 rounded-2xl bg-bg py-1.5 pl-2 pr-1.5 shadow-lg md:left-[504px]">
          <button
            type="button"
            aria-label="previous day"
            disabled={selectedDayIndex === 0}
            onClick={() => setSelectedDayIndex((i) => Math.max(0, i - 1))}
            className="flex size-7 items-center justify-center rounded-full text-ink-soft disabled:opacity-30"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="flex items-center gap-2 whitespace-nowrap px-1 text-[13px] font-semibold tracking-tight">
            {t("day", { n: activeDay.day })}
            <span className="hidden text-[12.5px] font-medium text-muted md:inline">
              {tr(activeDay.region_code)} · {formatMonthDayWeekday(activeDay.date, locale)}
            </span>
          </span>
          <button
            type="button"
            aria-label="next day"
            disabled={selectedDayIndex === dayCount - 1}
            onClick={() => setSelectedDayIndex((i) => Math.min(dayCount - 1, i + 1))}
            className="flex size-7 items-center justify-center rounded-full text-ink-soft disabled:opacity-30"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {hasMyLocation && (
        <div className="absolute left-6 bottom-6 hidden items-center gap-2.5 rounded-2xl bg-bg px-4 py-3 shadow-lg md:left-[504px] md:flex">
          <MapPin size={13} className="text-brand" />
          <span className="text-[13px] font-medium text-muted">{tc("myLocation")}</span>
        </div>
      )}

      {/* 데스크톱 좌측 패널 */}
      <div className="hidden h-full w-[480px] flex-col overflow-hidden border-r border-bg-subtle bg-bg md:flex">
        <div className="overflow-y-auto px-8 pb-0 pt-[30px]">{header}</div>
        <div className="h-2 shrink-0 bg-bg-subtler" />
        <div className="flex-grow overflow-y-auto px-8 pt-[22px]">{daysContent}</div>
        {footer}
      </div>

      {/* 모바일 바텀시트 */}
      <div
        className={
          "absolute inset-x-0 bottom-0 flex flex-col rounded-t-[20px] bg-bg shadow-[0_-6px_28px_rgba(25,31,40,.12)] transition-[height] duration-300 md:hidden " +
          (expanded ? "h-full rounded-none" : "h-[62%]")
        }
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex shrink-0 items-center justify-center py-2"
          aria-label="toggle"
        >
          {expanded ? (
            <ChevronDown size={16} className="text-faint" />
          ) : (
            <span className="h-1 w-9 rounded-full bg-line" />
          )}
        </button>
        <div className="overflow-y-auto px-5 pb-2">{header}</div>
        <div className="h-2 shrink-0 bg-bg-subtler" />
        <div className="flex-grow overflow-y-auto px-5 pt-4">{daysContent}</div>
        {footer}
        {!expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold text-faint"
          >
            <ChevronUp size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function MetaChip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={
        "flex h-[30px] items-center whitespace-nowrap rounded-full bg-bg-subtle px-2.5 text-[12.5px] font-semibold text-ink-soft md:h-8 md:px-3 md:text-[13px] " +
        className
      }
    >
      {children}
    </span>
  );
}
