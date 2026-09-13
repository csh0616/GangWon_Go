"use client";

import { useTranslations, useLocale } from "next-intl";
import { MapPinned } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDateRange } from "@/app/lib/date";
import type { GenerateRequest } from "@/app/lib/types";
import type { UiLocale } from "@/app/lib/localized";

/**
 * PRD 3.5절 대상 화면. 아트보드(Loading.dc.html)는 단일 시군을 전제로 하는데, "어디든지"/다중 시군
 * 요청은 이 시점엔 지역이 아직 안 정해져 있다 — 프론트 세션 프롬프트가 직접 판단하라고 명시한 두 항목 중
 * 하나. "어디든지"는 지역을 찾는 중이라는 문구로, 다중 시군은 시군명을 나열하는 문구로 분기한다.
 */
export function LoadingScreen({ request }: { request: GenerateRequest }) {
  const t = useTranslations("loading");
  const tr = useTranslations("regions");
  const locale = useLocale() as UiLocale;

  const isAuto = request.region_codes.length === 0;
  const isMulti = request.region_codes.length > 1;
  const regionSeparator = locale === "ko" ? " · " : locale === "zh" ? "、" : " & ";
  const regionList = request.region_codes.map((r) => tr(r)).join(regionSeparator);

  const title = isAuto
    ? t("titleAuto")
    : isMulti
      ? t("titleMulti", { regions: regionList })
      : t("titleSingle", { region: tr(request.region_codes[0]) });

  return (
    <div className="flex min-h-dvh flex-col">
      <Header showCareLink={false} />
      <div className="flex flex-grow flex-col justify-center px-5 pb-10 md:mx-auto md:w-full md:max-w-md">
        <span className="flex size-[52px] items-center justify-center rounded-full bg-brand-bg">
          <MapPinned size={25} className="text-brand" strokeWidth={1.7} />
        </span>
        <h1 className="mt-[22px] whitespace-pre-line text-[27px] font-bold leading-[1.42] tracking-tight">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted">{t("subtitle")}</p>

        <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-bg-subtle">
          <div className="h-1.5 w-2/3 animate-pulse rounded-full bg-brand" />
        </div>

        <div className="mt-[30px] rounded-2xl bg-bg-subtler px-[18px] py-1">
          <Row label={t("rowRegion")} value={isAuto ? t("rowRegionPending") : regionList} />
          <Row label={t("rowDate")} value={formatDateRange(request.start_date, request.end_date, locale)} />
          <Row label={t("rowPeople")} value={`${request.companions}`} />
          {request.free_text && (
            <Row label={t("rowRequest")} value={request.free_text} last multiline />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  last,
  multiline,
}: {
  label: string;
  value: string;
  last?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className={"flex items-center justify-between py-3.5 " + (last ? "" : "border-b border-bg")}>
      <span className="shrink-0 text-[13.5px] font-medium text-muted">{label}</span>
      <span
        className={
          "text-right text-[14.5px] font-semibold tracking-tight " +
          (multiline ? "ml-4 max-w-[220px] font-medium leading-[1.55] text-ink-soft" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}
