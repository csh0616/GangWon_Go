"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { cn } from "@/app/lib/cn";

const LABELS: Record<AppLocale, string> = {
  ko: "한국어",
  en: "EN",
  zh: "中",
};

/**
 * 한국어가 기본 로케일이라(PRD 2.3절), 아트보드처럼 "지금 언어 제외 나머지"를 보여주는
 * 전환 칩으로 만든다 — 한국어 화면에서는 EN/中 두 개만 보여 아트보드와 동일하고,
 * 영어·중국어 화면에서는 그 자리에 "한국어"가 나타나 항상 되돌아올 수 있다.
 */
export function LangSwitcher({ size = "md" }: { size?: "sm" | "md" }) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();

  const otherLocales = routing.locales.filter((l) => l !== locale);

  return (
    <div className="flex items-center gap-0.5 rounded-full bg-bg-subtle p-[3px]">
      {otherLocales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => router.replace(pathname, { locale: l })}
          className={cn(
            "flex items-center rounded-full font-bold text-ink-soft hover:text-ink",
            size === "md" ? "h-[26px] px-[11px] text-[11px]" : "h-6 px-2.5 text-[10px]"
          )}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
