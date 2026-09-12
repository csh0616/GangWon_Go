"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/app/lib/cn";

const LABELS: Record<(typeof routing.locales)[number], string> = {
  en: "EN",
  zh: "中",
};

export function LangSwitcher({ size = "md" }: { size?: "sm" | "md" }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-0.5 rounded-full bg-bg-subtle p-[3px]">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => router.replace(pathname, { locale: l })}
          className={cn(
            "flex items-center rounded-full font-bold text-muted",
            size === "md" ? "h-[26px] px-[11px] text-[11px]" : "h-6 px-2.5 text-[10px]",
            l === locale && "bg-bg text-ink"
          )}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
