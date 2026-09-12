"use client";

import { useTranslations } from "next-intl";
import { Bell, ChevronRight } from "lucide-react";

/** design/artboards/AlertBanner.dc.html — 코스 화면 밖(마이페이지·케어 등)에서 뜨는 전역 배너 */
export function AlertBanner({ onClick }: { onClick: () => void }) {
  const t = useTranslations("managing");

  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed inset-x-4 bottom-4 z-30 flex items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-left shadow-2xl md:inset-x-auto md:right-8 md:w-[380px]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
        <Bell size={17} className="text-white" strokeWidth={1.8} />
      </span>
      <span className="flex-grow text-[13.5px] font-semibold text-white">{t("bannerText")}</span>
      <span className="flex shrink-0 items-center gap-0.5 text-[12.5px] font-bold text-white">
        {t("bannerAction")}
        <ChevronRight size={14} />
      </span>
    </button>
  );
}
