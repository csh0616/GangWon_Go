"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { getSession } from "@/app/lib/mock/auth";

/** design/artboards/Main.dc.html 상단 배너 — 로그인 전(게스트)일 때만 노출 */
export function GuestLoginHint() {
  const t = useTranslations("common");
  const [loggedIn, setLoggedIn] = useState(true); // 서버/클라 불일치 깜빡임 방지: 기본은 숨김

  useEffect(() => {
    // sessionStorage는 SSR에 없으므로 마운트 후 클라이언트에서만 읽어 하이드레이션한다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoggedIn(Boolean(getSession()));
  }, []);

  if (loggedIn) return null;

  return (
    <div className="flex items-center gap-2.5 bg-brand-bg px-5 py-3">
      <span className="flex-grow text-[12.5px] font-medium tracking-tight text-brand-hover">
        {t("loginBanner")}
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-[12.5px] font-bold text-brand">
        {t("login")}
        <ChevronRight size={12} />
      </span>
    </div>
  );
}
