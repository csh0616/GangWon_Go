"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LogOut, Mail } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { ItineraryListItem } from "@/components/mypage/ItineraryListItem";
import { DeleteConfirmModal } from "@/components/mypage/DeleteConfirmModal";
import { getSession, mockGoogleLogin, logout, type Session } from "@/app/lib/mock/auth";
import { listItineraries, deleteItinerary } from "@/app/lib/api";
import { todayYmd } from "@/app/lib/date";
import type { SavedItinerarySummary } from "@/app/lib/types";

export default function MyPage() {
  const t = useTranslations("mypage");
  const tc = useTranslations("common");
  const router = useRouter();

  const [session, setSession] = useState<Session | null | "checking">("checking");
  const [items, setItems] = useState<SavedItinerarySummary[] | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [target, setTarget] = useState<SavedItinerarySummary | null>(null);

  useEffect(() => {
    // sessionStorage는 SSR에 없으므로 마운트 후 클라이언트에서만 읽어 하이드레이션한다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(getSession());
  }, []);

  useEffect(() => {
    if (session && session !== "checking") {
      listItineraries().then((res) => setItems(res.data?.itineraries ?? []));
    }
  }, [session]);

  async function handleLogin() {
    setLoggingIn(true);
    const res = await mockGoogleLogin();
    setLoggingIn(false);
    if (res.ok) setSession(res.session);
  }

  function handleLogout() {
    logout();
    setSession(null);
    setItems(null);
  }

  async function handleDelete(id: string) {
    await deleteItinerary(id);
    setItems((prev) => prev?.filter((it) => it.id !== id) ?? null);
    setTarget(null);
  }

  if (session === "checking") return null;

  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Header />
        <div className="flex flex-grow flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-muted">{t("empty")}</p>
          <div className="w-full max-w-xs">
            <Button onClick={handleLogin} disabled={loggingIn}>
              {loggingIn ? tc("loading") : tc("login")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const today = todayYmd();
  const active = (items ?? []).filter((it) => it.end_date >= today);
  const past = (items ?? []).filter((it) => it.end_date < today);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <div className="mx-auto w-full max-w-2xl flex-grow px-5 pb-10 md:px-0">
        <h1 className="pt-3 text-2xl font-bold tracking-tight">{t("title")}</h1>

        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-bg-subtle p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bg">
            <Mail size={17} className="text-ink-soft" strokeWidth={1.6} />
          </span>
          <div className="min-w-0 flex-grow">
            <p className="truncate text-[14px] font-bold">{session.user_id}@gmail.com</p>
            <p className="text-[12px] text-muted">{t("loggedInWithGoogle")}</p>
          </div>
        </div>

        <section className="mt-7">
          <div className="mb-1 flex items-baseline gap-2">
            <h2 className="text-base font-bold">{t("savedCourses")}</h2>
            <span className="text-[12.5px] font-medium text-muted">{active.length}</span>
          </div>
          {active.length === 0 ? (
            <p className="py-4 text-[13px] text-muted">{t("empty")}</p>
          ) : (
            <div className="divide-y divide-bg-subtle">
              {active.map((it) => (
                <ItineraryListItem
                  key={it.id}
                  item={it}
                  onOpen={() => router.push(`/itinerary/${it.id}`)}
                  onDelete={() => setTarget(it)}
                />
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section className="mt-8">
            <div className="mb-1 flex items-baseline gap-2">
              <h2 className="text-base font-bold">{t("pastTrips")}</h2>
              <span className="text-[12.5px] font-medium text-muted">{past.length}</span>
            </div>
            <div className="divide-y divide-bg-subtle">
              {past.map((it) => (
                <ItineraryListItem
                  key={it.id}
                  item={it}
                  onOpen={() => router.push(`/itinerary/${it.id}`)}
                  onDelete={() => setTarget(it)}
                />
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-faint">{t("pastFootnote")}</p>
          </section>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="mt-10 flex items-center gap-1.5 text-[13px] font-semibold text-muted"
        >
          <LogOut size={14} strokeWidth={1.8} />
          {t("logout")}
        </button>
      </div>

      {target && (
        <DeleteConfirmModal
          item={target}
          onCancel={() => setTarget(null)}
          onConfirm={() => handleDelete(target.id)}
        />
      )}
    </div>
  );
}
