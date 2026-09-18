"use client";

import { useTranslations } from "next-intl";
import { UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuthSession } from "@/app/lib/useAuthSession";
import { LangSwitcher } from "./LangSwitcher";

export function Header({ showCareLink = true }: { showCareLink?: boolean }) {
  const t = useTranslations("common");
  const tmy = useTranslations("mypage");
  const { session } = useAuthSession();
  const loggedIn = Boolean(session);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-5 md:h-16 md:px-8">
      <Link href="/" className="text-[15px] font-extrabold tracking-tighter md:text-base">
        {t("brand")}
      </Link>
      <div className="flex items-center gap-3.5 md:gap-[22px]">
        {showCareLink && (
          <Link href="/care" className="text-[13px] font-semibold text-ink-soft md:text-sm">
            {t("care")}
          </Link>
        )}
        <div className="flex items-center gap-2.5">
          <LangSwitcher />
          <Link
            href="/mypage"
            aria-label={tmy("title")}
            className={
              "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors md:size-[34px] " +
              (loggedIn ? "bg-brand-bg" : "bg-bg-subtle")
            }
          >
            <UserRound
              size={16}
              strokeWidth={1.6}
              className={loggedIn ? "text-brand" : "text-ink-soft"}
            />
          </Link>
        </div>
      </div>
    </header>
  );
}
