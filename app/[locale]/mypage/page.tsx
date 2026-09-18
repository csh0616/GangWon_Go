"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LogOut, Mail } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { ItineraryListItem } from "@/components/mypage/ItineraryListItem";
import { DeleteConfirmModal } from "@/components/mypage/DeleteConfirmModal";
import { mockGoogleLogin, logout } from "@/app/lib/auth";
import { useAuthSession } from "@/app/lib/useAuthSession";
import { listItineraries, deleteItinerary } from "@/app/lib/api";
import { todayYmd } from "@/app/lib/date";
import type { SavedItinerarySummary } from "@/app/lib/types";

export default function MyPage() {
  const t = useTranslations("mypage");
  const tc = useTranslations("common");
  const router = useRouter();

  const { session, ready } = useAuthSession();
  // null = 로딩 중, "error" = 조회 실패(빈 배열과 구분해야 함 — 리포트 05/20), 배열 = 성공
  const [items, setItems] = useState<SavedItinerarySummary[] | null | "error">(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [target, setTarget] = useState<SavedItinerarySummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const fetchItems = useCallback(() => {
    setItems(null);
    listItineraries().then((res) => setItems(res.data ? res.data.itineraries : "error"));
  }, []);

  useEffect(() => {
    // session(외부 상태)이 도착하거나 바뀔 때 다시 조회하는 것이라 렌더 중 파생이 불가능하다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session) fetchItems();
  }, [session, fetchItems]);

  async function handleLogin() {
    setLoggingIn(true);
    await mockGoogleLogin();
    // 실제 Google 로그인은 리다이렉트라 이 줄까지 정상적으로 오면 리다이렉트가 시작되지
    // 않은 것이다 — useAuthSession이 세션 도착을 계속 지켜보므로 여기서 더 할 일은 없다.
    setLoggingIn(false);
  }

  function handleLogout() {
    logout();
    setItems(null);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const res = await deleteItinerary(id);
    setDeleting(false);
    if (!res.data) {
      // 성공 여부를 확인하지 않고 목록에서 지우면 실패를 성공처럼 보여주게 된다(리포트 05) —
      // 모달은 열어둔 채로 실패를 알리고 다시 시도하게 한다.
      setDeleteError(true);
      return;
    }
    setDeleteError(false);
    setItems((prev) => (Array.isArray(prev) ? prev.filter((it) => it.id !== id) : prev));
    setTarget(null);
  }

  if (!ready) return null;

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
  // items가 null(로딩)/"error"(실패)일 때도 안전하게 빈 목록으로 다룬다 — 로딩/에러 표시는
  // 아래 JSX에서 items 자체를 보고 따로 분기한다.
  const itemsList = Array.isArray(items) ? items : [];
  const active = itemsList.filter((it) => it.end_date >= today);
  const past = itemsList.filter((it) => it.end_date < today);

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
            {/* user_id에 "@gmail.com"을 붙여 지어낸 가짜 이메일을 보여주던 버그(리포트 23) —
                실제 세션의 이메일이 있을 때만 표시하고, 없으면 이 줄 자체를 생략한다. */}
            {session.email && <p className="truncate text-[14px] font-bold">{session.email}</p>}
            <p className="text-[12px] text-muted">{t("loggedInWithGoogle")}</p>
          </div>
        </div>

        <section className="mt-7">
          <div className="mb-1 flex items-baseline gap-2">
            <h2 className="text-base font-bold">{t("savedCourses")}</h2>
            {Array.isArray(items) && <span className="text-[12.5px] font-medium text-muted">{active.length}</span>}
          </div>
          {items === null ? (
            <p className="py-4 text-[13px] text-muted">{tc("loading")}</p>
          ) : items === "error" ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-[13px] text-muted">{t("loadError")}</p>
              <button type="button" onClick={fetchItems} className="text-[12.5px] font-bold text-brand">
                {tc("retry")}
              </button>
            </div>
          ) : active.length === 0 ? (
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
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            setTarget(null);
            setDeleteError(false);
          }}
          onConfirm={() => handleDelete(target.id)}
        />
      )}
    </div>
  );
}
