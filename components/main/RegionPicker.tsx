"use client";

import { useTranslations } from "next-intl";
import { Chip } from "@/components/ui/Chip";
import { REGION_MASTER } from "@/app/lib/regions";
import type { OpenRegionCode } from "@/app/lib/types";

type Props = {
  autoMode: boolean;
  selected: OpenRegionCode[];
  freeTextEmpty: boolean;
  onSelectAuto: () => void;
  onToggleRegion: (code: OpenRegionCode) => void;
};

export function RegionPicker({ autoMode, selected, freeTextEmpty, onSelectAuto, onToggleRegion }: Props) {
  const t = useTranslations("main");
  const tr = useTranslations("regions");

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Chip
          selected={autoMode}
          unavailable={freeTextEmpty}
          onClick={onSelectAuto}
          title={freeTextEmpty ? t("regionHintNoText") : undefined}
        >
          {tr("auto")}
        </Chip>
        {REGION_MASTER.map(({ code, open }) =>
          open ? (
            <Chip
              key={code}
              selected={!autoMode && selected.includes(code as OpenRegionCode)}
              onClick={() => onToggleRegion(code as OpenRegionCode)}
            >
              {tr(code)}
            </Chip>
          ) : (
            <Chip key={code} unavailable>
              {tr(code)}
            </Chip>
          )
        )}
      </div>

      {freeTextEmpty && (
        <div className="mt-3.5 flex items-start gap-2 rounded-2xl bg-brand-bg px-3.5 py-3">
          <span className="mt-px size-1.5 shrink-0 rounded-full bg-brand" />
          <span className="text-[12.5px] font-medium leading-relaxed text-brand-hover">
            {t("regionHintNoText")}
          </span>
        </div>
      )}
      {!freeTextEmpty && autoMode && (
        <div className="mt-3.5 flex items-start gap-2 rounded-2xl bg-brand-bg px-3.5 py-3">
          <span className="mt-px size-1.5 shrink-0 rounded-full bg-brand" />
          <span className="text-[12.5px] font-medium leading-relaxed text-brand-hover">
            {t("regionHintAuto")}
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="size-[9px] rounded-full bg-brand" />
          <span className="text-xs font-semibold text-ink-soft">{t("regionAvailableNow")}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-[9px] rounded-full bg-line" />
          <span className="text-xs font-medium text-faint">{t("regionComingSoon")}</span>
        </span>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{t("regionFootnote")}</p>
    </div>
  );
}
