"use client";

import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import type { TravelBetweenDays } from "@/app/lib/types";

/**
 * 시군 이동 줄 (travel_from_prev_day). day1은 항상 null이라 안 그려지고, null이면 아예 그리지 않는다.
 * from/to가 같아도 값은 오지만 시군명은 다를 때만 표시한다 (API_CONTRACT.md §1).
 */
export function RegionTravelBanner({ travel }: { travel: TravelBetweenDays }) {
  const t = useTranslations("result");
  const tr = useTranslations("regions");
  if (!travel) return null;

  const sameRegion = travel.from_region_code === travel.to_region_code;

  return (
    <div className="mb-3 ml-[62px] flex items-center gap-2 rounded-xl bg-bg-subtler px-3 py-2.5">
      <ArrowRight size={15} className="shrink-0 text-muted" strokeWidth={1.6} />
      <span className="text-[12.5px] font-semibold tracking-tight text-ink-soft">
        {sameRegion
          ? t("regionTravelSameMinutes", { minutes: travel.minutes })
          : t("regionTravel", {
              from: tr(travel.from_region_code),
              to: tr(travel.to_region_code),
              minutes: travel.minutes,
            })}
      </span>
    </div>
  );
}
