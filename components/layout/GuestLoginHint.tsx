"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { getSession, subscribeAuthChange } from "@/app/lib/mock/auth";
import { LoginModal } from "./LoginModal";

/** design/artboards/Main.dc.html 상단 배너 — 로그인 전(게스트)일 때만 노출 */
export function GuestLoginHint() {
  const t = useTranslations("common");
  const [loggedIn, setLoggedIn] = useState(true); // 서버/클라 불일치 깜빡임 방지: 기본은 숨김
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = useCallback(() => {
    // sessionStorage는 SSR에 없으므로 클라이언트에서만 읽는다
    setLoggedIn(Boolean(getSession()));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    return subscribeAuthChange(refresh);
  }, [refresh]);

  if (loggedIn) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex w-full items-center gap-2.5 bg-brand-bg px-5 py-3 text-left transition-colors hover:bg-brand/[0.12] active:bg-brand/[0.16]"
      >
        <span className="flex-grow text-[12.5px] font-medium tracking-tight text-brand-hover">
          {t("loginBanner")}
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-[12.5px] font-bold text-brand">
          {t("login")}
          <ChevronRight size={12} />
        </span>
      </button>
      <LoginModal open={modalOpen} onClose={() => setModalOpen(false)} onLoggedIn={() => setModalOpen(false)} />
    </>
  );
}
