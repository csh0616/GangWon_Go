"use client";

import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";

export function CompanionsStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const t = useTranslations("main");
  const MAX = 20;

  return (
    <div className="flex h-14 items-center justify-between rounded-2xl bg-bg-subtle py-0 pl-4 pr-2.5">
      <span className="text-[14.5px] font-semibold text-ink-soft">{t("companionsField")}</span>
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="-"
          disabled={value <= 1}
          onClick={() => onChange(Math.max(1, value - 1))}
          className="flex size-9 items-center justify-center rounded-full bg-bg disabled:opacity-40"
        >
          <Minus size={14} strokeWidth={2.2} />
        </button>
        <span className="w-[34px] text-center text-[17px] font-bold">{value}</span>
        <button
          type="button"
          aria-label="+"
          disabled={value >= MAX}
          onClick={() => onChange(Math.min(MAX, value + 1))}
          className="flex size-9 items-center justify-center rounded-full bg-bg disabled:opacity-40"
        >
          <Plus size={14} strokeWidth={2.2} />
        </button>
      </span>
    </div>
  );
}
