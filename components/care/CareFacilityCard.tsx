"use client";

import { useLocale } from "next-intl";
import { Phone } from "lucide-react";
import type { CareFacility } from "@/app/lib/types";
import type { UiLocale } from "@/app/lib/localized";

export function CareFacilityCard({
  facility,
  distanceKm,
  categoryLabel,
}: {
  facility: CareFacility;
  distanceKm: number | null;
  categoryLabel: string;
}) {
  const locale = useLocale() as UiLocale;
  const localizedName = locale === "zh" ? facility.name_zh : facility.name_en;

  return (
    <div className="flex items-center gap-3 py-3.5">
      <div className="min-w-0 flex-grow">
        <p className="truncate text-[14.5px] font-bold tracking-tight">{facility.name_ko}</p>
        {localizedName && <p className="truncate text-[12px] font-medium text-muted">{localizedName}</p>}
        <p className="mt-0.5 text-[12px] font-medium text-muted">{categoryLabel}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {distanceKm !== null && (
          <span className="text-[12.5px] font-semibold text-ink-soft">{distanceKm.toFixed(1)}km</span>
        )}
        {facility.phone && (
          <a
            href={`tel:${facility.phone}`}
            aria-label={facility.phone}
            className="flex size-8 items-center justify-center rounded-full bg-bg-subtle text-ink-soft"
          >
            <Phone size={14} strokeWidth={1.8} />
          </a>
        )}
      </div>
    </div>
  );
}
