"use client";

import { useTranslations, useLocale } from "next-intl";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { pickName, localizedText, type UiLocale } from "@/app/lib/localized";
import { cn } from "@/app/lib/cn";
import type { Stop } from "@/app/lib/types";

export function StopRow({
  stop,
  changed = false,
  editable = false,
  onSwap,
}: {
  stop: Stop;
  changed?: boolean;
  editable?: boolean;
  onSwap?: () => void;
}) {
  const t = useTranslations("result");
  const tc = useTranslations("categories");
  const locale = useLocale() as UiLocale;

  const { primary, secondary } = pickName(stop.name, locale);
  const blurb = localizedText(stop.blurb, locale);

  return (
    <div
      className={cn(
        "flex items-center gap-3.5 py-2",
        editable && "md:-mx-2 md:cursor-pointer md:rounded-xl md:px-2 md:hover:bg-bg-subtler"
      )}
      onClick={editable ? onSwap : undefined}
    >
      <span className="relative flex size-[46px] shrink-0 items-center justify-center rounded-2xl bg-bg-subtle">
        <span className="absolute -left-[3px] -top-[3px] flex size-[18px] items-center justify-center rounded-full border-2 border-bg bg-brand text-[10px] font-bold text-white">
          {stop.order}
        </span>
        <CategoryIcon category={stop.category} />
      </span>
      <span className="min-w-0 flex-grow">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[15.5px] font-semibold tracking-tight">{primary}</span>
          {secondary && <span className="text-xs font-medium text-faint">{secondary}</span>}
          {changed && (
            <span className="rounded-full bg-brand-bg px-2 py-0.5 text-[10.5px] font-bold text-brand">
              {t("changedBadge")}
            </span>
          )}
        </span>
        <div className="mt-0.5 text-[12.5px] font-medium text-muted">
          {tc(stop.category)}
          {blurb && <span className="text-ink-soft"> · {blurb}</span>}
        </div>
      </span>
      {editable && onSwap && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSwap();
          }}
          className="hidden shrink-0 rounded-full bg-bg-subtle px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft md:block"
        >
          {t("swap")}
        </button>
      )}
    </div>
  );
}
