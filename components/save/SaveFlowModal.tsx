"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { pickName, type UiLocale } from "@/app/lib/localized";
import { formatDateRange } from "@/app/lib/date";
import { getSession, mockGoogleLogin, subscribeAuthChange } from "@/app/lib/auth";
import { saveItinerary } from "@/app/lib/api";
import { markPendingSave, clearPendingSave } from "@/app/lib/storage";
import type { GenerateResponseData, Relationship } from "@/app/lib/types";

const AUTH_ARRIVAL_TIMEOUT_MS = 10000;

type Step = "prompt" | "authorizing" | "retry";

export function SaveFlowModal({
  open,
  onClose,
  result,
  meta,
  onSaved,
  resumeMode,
}: {
  open: boolean;
  onClose: () => void;
  result: GenerateResponseData;
  meta: {
    start_date: string;
    end_date: string;
    companions: number;
    relationship: Relationship;
  };
  onSaved: (itineraryId: string) => void;
  /**
   * 실제 Google 로그인은 팝업이 아니라 전체 페이지 리다이렉트다(P0-C) — "계속하기"를 눌렀을
   * 때의 이 모달 인스턴스는 돌아왔을 때 이미 사라진 뒤라, 로그인 이후 저장을 이어가려면
   * 부모(app/[locale]/result/page.tsx)가 새로 연 모달에 "왜 열렸는지"를 알려줘야 한다.
   * "save": 이미 로그인된 상태로 돌아왔다 — 곧장 저장을 이어간다(로그인 화면을 다시 보여주지 않음).
   * "retry": Google 동의 화면에서 취소했거나 리다이렉트 자체가 실패했다 — 재시도 화면부터 보여준다.
   */
  resumeMode?: "save" | "retry";
}) {
  const t = useTranslations("save");
  const tc = useTranslations("common");
  const tr = useTranslations("regions");
  const trel = useTranslations("relationships");
  const locale = useLocale() as UiLocale;
  const [step, setStep] = useState<Step>(resumeMode === "retry" ? "retry" : "prompt");
  const [saving, setSaving] = useState(false);

  const title = result.selected_regions.region_codes.map((r) => tr(r)).join(" · ");
  const previewStops = result.itinerary_json.days.flatMap((d) => d.stops).slice(0, 3);
  const totalStops = result.itinerary_json.days.reduce((s, d) => s + d.stops.length, 0);

  // 이 모달은 부모(result/page.tsx)에 항상 마운트돼 있고 open prop으로만 보이고 안 보이고가
  // 갈린다 — 그래서 컴포넌트 언마운트가 아니라 open의 "지금" 값을 직접 봐야 사용자가 저장
  // 응답을 기다리다 모달을 닫고 다른 화면으로 옮긴 것을 알 수 있다(외부 검수 리포트 37).
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  async function completeSave() {
    setSaving(true);
    const saveRes = await saveItinerary({
      itinerary_json: result.itinerary_json,
      preference_weights: result.preference_weights,
      region_codes: result.selected_regions.region_codes,
      ...meta,
    });
    setSaving(false);
    if (!openRef.current) {
      // 응답이 오기 전에 사용자가 이미 모달을 닫고 다른 화면으로 옮겼다(리포트 37) — 요청을
      // 취소한 게 아니라 응답을 기다리지 않기로 한 것뿐이라 서버 저장 자체는 그대로 진행됐을
      // 수 있다. 그렇다고 지금 와서 화면을 강제로 옮기거나(onSaved) 게스트 임시 데이터를
      // 정리하면 안 된다 — 요청 취소가 곧 서버 저장 취소는 아니다. 저장됐다면 마이페이지에서
      // 확인할 수 있다.
      return;
    }
    if (saveRes.data) {
      onSaved(saveRes.data.itinerary_id);
    } else {
      // 저장 자체가 실패하면(드묾) 재시도 화면으로 되돌림 — 게스트 코스는 유지됨
      setStep("retry");
    }
  }

  useEffect(() => {
    if (!open) return;

    if (resumeMode === "retry") {
      // 부모가 나중에 resumeMode를 "retry"로 바꿔도(예: 동의 화면 취소 감지가 조금 늦게 온
      // 경우) step에 반영되도록 초기값뿐 아니라 여기서도 동기화한다(리포트 12).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep("retry");
      return;
    }

    if (getSession()) {
      // 이미 로그인돼 있으면(일반 오픈이든 리다이렉트 복귀 직후든) OAuth를 다시 시작하지
      // 않고 곧장 저장한다 — 세션이 있는데도 로그인 화면을 다시 띄우던 버그(리포트 11).
      setStep("authorizing");
      void completeSave();
      return;
    }

    if (resumeMode !== "save") return; // 일반 오픈 + 아직 미로그인 → prompt 화면에서 대기

    // resumeMode === "save"인데 세션이 아직 캐시에 없다 — getSession()은 동기 캐시라
    // 리다이렉트 직후엔 Supabase의 onAuthStateChange가 아직 안 왔을 수 있다(원인 2, 이전에는
    // 여기서 한 번만 확인하고 끝나 세션이 뒤늦게 도착해도 반영되지 않았다). 도착할 때까지
    // 구독하고, 일정 시간 넘으면 재시도 화면으로 전환한다.
    let settled = false;
    setStep("authorizing");
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      setStep("retry");
    }, AUTH_ARRIVAL_TIMEOUT_MS);
    const unsubscribe = subscribeAuthChange(() => {
      if (settled) return;
      const session = getSession();
      if (!session) return;
      settled = true;
      clearTimeout(timeoutId);
      unsubscribe();
      void completeSave();
    });

    return () => {
      settled = true;
      clearTimeout(timeoutId);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resumeMode]);

  function handleClose() {
    // 인증을 시작하려던 흔적이 남아 있으면 다음 결과 페이지 진입에서 저장 재개가 잘못
    // 켜질 수 있다(리포트 27) — 명시적으로 닫을 때 지운다.
    clearPendingSave();
    onClose();
  }

  async function handleGoogleContinue() {
    if (getSession()) {
      // 이미 로그인된 상태에서 눌렸다면(리포트 11과 같은 이유) OAuth를 새로 시작하지 않는다.
      setStep("authorizing");
      await completeSave();
      return;
    }
    setStep("authorizing");
    // 리다이렉트로 페이지가 이동하기 전에 "저장을 이어가려 했다"는 사실을 남겨둔다 —
    // 돌아온 뒤 result 페이지가 이 값을 보고 로그인 화면 없이 곧장 저장을 재개한다.
    markPendingSave();
    const res = await mockGoogleLogin();
    if (!res.ok) {
      // 리다이렉트 자체가 시작되지 않았다 — 방금 남긴 pending_save는 무효하니 지운다(리포트 27).
      clearPendingSave();
      setStep("retry");
      return;
    }
    // 정상적인 리다이렉트 플로우라면 이 아래는 실행되지 않는다(페이지가 이미 이동했다) —
    // 리다이렉트 없이 세션이 즉시 생기는 예외적 경로를 위한 방어적 continuation일 뿐이다.
    await completeSave();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <div className="p-6">
        <div className="mb-5 rounded-2xl bg-bg-subtler p-4">
          <p className="text-[15px] font-bold tracking-tight">
            {result.selected_regions.region_codes.map((r) => tr(r)).join(" · ")}
          </p>
          <p className="mt-1 text-xs font-medium text-muted">
            {formatDateRange(meta.start_date, meta.end_date, locale)} · {meta.companions} · {trel(meta.relationship)}
          </p>
          <div className="mt-3 space-y-2.5">
            {previewStops.map((stop) => {
              const { primary } = pickName(stop.name, locale);
              return (
                <div key={stop.poi_id} className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-bg">
                    <CategoryIcon category={stop.category} size={15} />
                  </span>
                  <span className="text-[13px] font-semibold">{primary}</span>
                </div>
              );
            })}
          </div>
        </div>

        {step === "retry" ? (
          <RetryStep stops={totalStops} onRetry={handleGoogleContinue} onContinueWithoutSaving={handleClose} />
        ) : (
          <>
            <h2 className="whitespace-pre-line text-xl font-bold leading-snug tracking-tight">
              {t("loginPromptTitle")}
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">{t("loginPromptBody")}</p>
            <p className="mt-3 text-xs leading-relaxed text-faint">
              {t.rich("loginPromptKeep", {
                course: title,
                b: (chunks) => <span className="font-semibold text-ink-soft">{chunks}</span>,
              })}
            </p>
            <div className="mt-6">
              <Button onClick={handleGoogleContinue} disabled={step === "authorizing" || saving}>
                {step === "authorizing" || saving ? tc("loading") : t("continueWithGoogle")}
              </Button>
              <button
                type="button"
                onClick={handleClose}
                className="mt-3 w-full py-2 text-center text-[13px] font-semibold text-muted"
              >
                {t("later")}
              </button>
            </div>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-faint">{t("loginTerms")}</p>
          </>
        )}
      </div>
    </Dialog>
  );
}

function RetryStep({
  stops,
  onRetry,
  onContinueWithoutSaving,
}: {
  stops: number;
  onRetry: () => void;
  onContinueWithoutSaving: () => void;
}) {
  const t = useTranslations("save");
  const tc = useTranslations("common");
  const tResult = useTranslations("result");

  return (
    <>
      <h2 className="whitespace-pre-line text-xl font-bold leading-snug tracking-tight">{t("retryTitle")}</h2>
      <p className="mt-2.5 text-sm leading-relaxed text-muted">{t("retryBody")}</p>
      <div className="mt-4 rounded-2xl bg-brand-bg px-4 py-3">
        <p className="text-[12.5px] font-bold text-brand-hover">{t("retryKeepTitle")}</p>
        <p className="mt-1 text-[12px] text-brand">{tResult("stops", { count: stops })}</p>
      </div>
      <div className="mt-6">
        <Button onClick={onRetry}>{tc("retry")}</Button>
        <button
          type="button"
          onClick={onContinueWithoutSaving}
          className="mt-3 w-full py-2 text-center text-[13px] font-semibold text-muted"
        >
          {t("retryContinueWithoutSaving")}
        </button>
      </div>
    </>
  );
}
