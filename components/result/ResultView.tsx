"use client";

import { useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Clock3, MapPin, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StopRow } from "./StopRow";
import { TravelLeg } from "./TravelLeg";
import { RegionTravelBanner } from "./RegionTravelBanner";
import { EmptyDayNotice } from "./EmptyDayNotice";
import { PrefChips } from "./PrefChips";
import { MapView, type MapViewHandle } from "./MapView";
import { localizedText, type UiLocale } from "@/app/lib/localized";
import { formatDateRange, formatMonthDayWeekday, diffDaysInclusive, todayYmd } from "@/app/lib/date";
import { buildResultTitle } from "@/app/lib/resultTitle";
import { useDayScrollSpy } from "@/app/lib/useDayScrollSpy";
import type {
  ItineraryJson,
  PreferenceWeights,
  RegionCode,
  Relationship,
  SelectedRegions,
} from "@/app/lib/types";

// "cancelled" — 마이페이지에서 삭제한 코스(리포트 31). 삭제 후에도 직접 URL로 들어오면
// 여전히 매니징 중인 것처럼 보이던 버그의 수정 대상.
export type SavedStatus = "unsaved" | "saved" | "watching" | "cancelled";

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
  const [isViewingMyLocation, setIsViewingMyLocation] = useState(false);
  const mapViewRef = useRef<MapViewHandle>(null);

  const { days, narration, region_reason } = itineraryJson;
  const dayCount = days.length;
  const activeDay = days[selectedDayIndex] ?? days[0];

  // 화살표를 빠르게 연타하면 React 상태 업데이트가 배치되어 클릭 핸들러들이 모두
  // 같은 렌더의(오래된) selectedDayIndex를 참조하게 된다 — ref에 최신값을 동기로
  // 유지해두고 화살표는 항상 이 ref를 기준으로 다음/이전을 계산한다.
  const selectedDayIndexRef = useRef(0);
  function updateSelectedDayIndex(index: number) {
    selectedDayIndexRef.current = index;
    setSelectedDayIndex(index);
  }

  // 데스크톱 좌측 패널과 모바일 시트는 각각 독립된 스크롤 컨테이너다 — 두 트리 모두
  // 항상 DOM에 존재하므로(반응형은 CSS로만 숨김) refs와 옵저버도 따로 둔다.
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const desktopDayRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const mobileDayRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { scrollToDay: scrollToDayDesktop } = useDayScrollSpy({
    containerRef: desktopScrollRef,
    dayRefs: desktopDayRefs,
    dayCount,
    enabled: dayCount > 1,
    onDayChange: updateSelectedDayIndex,
  });
  const { scrollToDay: scrollToDayMobile } = useDayScrollSpy({
    containerRef: mobileScrollRef,
    dayRefs: mobileDayRefs,
    dayCount,
    enabled: dayCount > 1,
    onDayChange: updateSelectedDayIndex,
  });

  // 위치 권한이 나중에 꺼지거나(브라우저 설정 변경) 지도가 실패로 전환되면 배지 자체가
  // 사라지는데, 그 상태에서 isViewingMyLocation만 true로 남아 있으면 나중에 배지가 다시
  // 뜰 때 사용자가 누르지도 않은 "코스 보기"부터 보여주게 된다 — 같이 되돌린다.
  function handleMyLocationChange(has: boolean) {
    setHasMyLocation(has);
    if (!has) setIsViewingMyLocation(false);
  }

  function goToDay(index: number) {
    const clamped = Math.max(0, Math.min(dayCount - 1, index));
    updateSelectedDayIndex(clamped);
    // 둘 다 부르되, 화면에 없는(스크롤 불가한) 쪽은 사실상 아무 일도 하지 않는다
    scrollToDayDesktop(clamped);
    scrollToDayMobile(clamped);
  }
  const stopCount = days.reduce((sum, d) => sum + d.stops.length, 0);
  const title = buildResultTitle(selectedRegions.region_codes, dayCount, tr, t("titleSuffix"));
  const narrationText = localizedText(narration, locale);
  const regionReasonText = localizedText(region_reason, locale);
  const today = todayYmd();

  function renderDays(dayRefs: React.RefObject<(HTMLDivElement | null)[]>) {
    return (
      <>
        {days.map((day, dayIndex) => {
          const selected = dayIndex === selectedDayIndex;
          return (
            <div
              key={day.day}
              ref={(el) => {
                dayRefs.current[dayIndex] = el;
              }}
              className={
                "-ml-3 border-l-[3px] pl-3 transition-colors duration-300 " +
                (selected ? "border-brand bg-brand-bg/40" : "border-transparent bg-transparent")
              }
            >
              <button
                type="button"
                onClick={() => goToDay(dayIndex)}
                className="flex w-full items-baseline gap-2.5 pb-1.5 pt-[18px] text-left first:pt-0"
              >
                <span
                  className={
                    "text-[17px] font-bold tracking-tight md:text-[18px] " +
                    (selected ? "text-brand" : "")
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
          );
        })}
      </>
    );
  }

  const metaChips = (
    <div className="flex flex-wrap gap-1.5 md:gap-2">
      <MetaChip>{formatDateRange(startDate, endDate, locale)}</MetaChip>
      <MetaChip>{companions}</MetaChip>
      <MetaChip>{trel(relationship)}</MetaChip>
      <MetaChip className="hidden md:flex">{t("stops", { count: stopCount })}</MetaChip>
      <span className="flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full bg-bg-subtle px-2.5 text-[12.5px] font-bold text-ink-soft md:h-8 md:px-[11px] md:text-[13px]">
        <Clock3 size={12} className="text-muted" strokeWidth={1.4} />
        {status === "unsaved"
          ? t("notSaved")
          : status === "watching"
            ? t("watching")
            : status === "cancelled"
              ? t("deleted")
              : t("saved")}
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

  // 모바일 하단 padding은 pb-6(24px) 대신 env(safe-area-inset-bottom)까지 고려한다 —
  // 시트가 뷰포트 바닥까지 닿게 되면 iOS 홈 인디케이터 제스처 영역과 버튼이 겹칠 수
  // 있다. 데스크톱은 안전영역이 없는 레이아웃이라 md:에서 기존 값을 그대로 둔다.
  const footer = status === "unsaved" && onSave ? (
    <div className="border-t-0 bg-bg px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 md:px-8 md:pb-6 md:pt-3.5">
      <p className="mb-3 hidden text-[12.5px] text-muted md:block">{t("saveHint")}</p>
      <Button onClick={onSave}>{t("saveButton")}</Button>
    </div>
  ) : status === "watching" ? (
    <div className="border-t border-bg-subtle px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:py-4">
      <p className="text-[12.5px] font-semibold text-ink-soft">{t("watchingTitle")}</p>
      <p className="mt-0.5 text-[12px] text-muted">{t("watchingSubtitle")}</p>
    </div>
  ) : status === "cancelled" ? (
    <div className="border-t border-bg-subtle px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:py-4">
      <p className="text-[12.5px] font-semibold text-danger">{t("deletedTitle")}</p>
      <p className="mt-0.5 text-[12px] text-muted">{t("deletedSubtitle")}</p>
    </div>
  ) : null;

  return (
    <div className="relative h-[calc(100dvh-56px)] overflow-hidden md:h-[calc(100dvh-64px)]">
      {/* 지도 (모바일: 배경 전체 / 데스크톱: 우측 패널) — 카카오맵 SDK가 내부 레이어에
          명시적 양수 z-index를 붙여서, isolate 없이는 DOM 순서상 뒤에 오는 형제 요소(바텀시트 등,
          z-index: auto)보다도 위에 그려진다. isolate로 새 스택 컨텍스트를 만들어 그 z-index가
          바깥으로 새지 않게 가둔다 */}
      <div className="absolute inset-0 isolate md:left-[480px]">
        <MapView ref={mapViewRef} day={activeDay} onMyLocationChange={handleMyLocationChange} />
      </div>

      {/* DAY 전환 — 지도가 어느 날짜를 보여주는지 표시하고 좌우로 넘길 수 있다 */}
      {dayCount > 1 && (
        <div className="absolute left-6 top-6 z-20 flex items-center gap-1 rounded-2xl bg-bg py-1.5 pl-2 pr-1.5 shadow-lg md:left-[504px]">
          <button
            type="button"
            aria-label="previous day"
            disabled={selectedDayIndex === 0}
            onClick={() => goToDay(selectedDayIndexRef.current - 1)}
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
            onClick={() => goToDay(selectedDayIndexRef.current + 1)}
            className="flex size-7 items-center justify-center rounded-full text-ink-soft disabled:opacity-30"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* 내 위치 ↔ 코스 보기 토글 — 모바일 바텀시트(접힌 상태 h-[62%])가 좌하단을 완전히
          가리므로 모바일에서는 지도가 항상 보이는 우상단에 둔다(DAY 칩이 left-6 top-6이라
          겹치지 않게 반대쪽). 데스크톱은 기존 좌하단 위치 그대로. MapView 안(지도의 isolate
          스택 컨텍스트 내부)으로 옮기면 카카오 SDK 내부 레이어의 z-index와 직접 경쟁하게
          되어 예전에 바텀시트가 지도 뒤로 숨었던 것과 같은 사고가 재발한다 — ResultView
          쪽에 그대로 둔다. */}
      {hasMyLocation && (
        <button
          type="button"
          onClick={() => {
            if (isViewingMyLocation) {
              mapViewRef.current?.fitToCourse();
              setIsViewingMyLocation(false);
            } else {
              mapViewRef.current?.panToMyLocation();
              setIsViewingMyLocation(true);
            }
          }}
          className="absolute right-5 top-6 z-20 flex items-center gap-2.5 rounded-2xl bg-bg px-4 py-3 shadow-lg md:right-auto md:top-auto md:left-[504px] md:bottom-6"
        >
          <MapPin size={13} className="text-brand" />
          <span className="text-[13px] font-medium text-muted">
            {isViewingMyLocation ? tc("backToCourse") : tc("myLocation")}
          </span>
        </button>
      )}

      {/* 데스크톱 좌측 패널 */}
      <div className="hidden h-full w-[480px] flex-col overflow-hidden border-r border-bg-subtle bg-bg md:flex">
        <div className="overflow-y-auto px-8 pb-0 pt-[30px]">{header}</div>
        <div className="h-2 shrink-0 bg-bg-subtler" />
        <div ref={desktopScrollRef} className="flex-grow overflow-y-auto px-8 pt-[22px]">
          {renderDays(desktopDayRefs)}
        </div>
        {footer}
      </div>

      {/* 모바일 바텀시트 — z-20: 지도 래퍼는 isolate로 갇혀 있어 원래도 auto(0)로 비교되지만,
          지도 위에 뜨는 다른 요소들과 동일한 z 계층(지도 0 / 오버레이 20 / 시트 20 / 배너 30 /
          모달 40, AlertBanner.tsx·Dialog.tsx 참고)을 명시적으로 맞춘다 */}
      <div
        className={
          "absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[20px] bg-bg shadow-[0_-6px_28px_rgba(25,31,40,.12)] transition-[height] duration-300 md:hidden " +
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
        <div className="shrink-0 px-5 pb-2">{header}</div>
        <div className="h-2 shrink-0 bg-bg-subtler" />
        <div ref={mobileScrollRef} className="flex-grow overflow-y-auto px-5 pt-4">
          {renderDays(mobileDayRefs)}
        </div>
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
