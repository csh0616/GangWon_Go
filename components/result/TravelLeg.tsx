"use client";

import { useTranslations } from "next-intl";
import type { Travel } from "@/app/lib/types";

/** travel_from_prev가 null이면 줄 자체를 그리지 않는다 (PRD 6장 — 추정 이동시간을 지어내지 않음) */
export function TravelLeg({ travel }: { travel: Travel }) {
  const t = useTranslations("result");
  if (!travel) return null;

  return (
    <div className="flex items-center gap-3.5 py-px">
      <span className="flex w-[46px] shrink-0 justify-center">
        <span className="h-5 w-0 border-l-2 border-dotted border-line" />
      </span>
      <span className="text-[11.5px] font-medium text-faint">
        {travel.mode === "walk"
          ? t("walkMinutes", { minutes: travel.minutes })
          : t("carMinutes", { minutes: travel.minutes })}
      </span>
    </div>
  );
}
