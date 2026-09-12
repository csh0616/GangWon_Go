"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { CloudRain } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { pickName, localizedText, type UiLocale } from "@/app/lib/localized";
import { formatMonthDayWeekday } from "@/app/lib/date";
import type { AlertPayload, ItineraryJson } from "@/app/lib/types";

const TIMEOUT_SECONDS = 180;

function findStopContext(itineraryJson: ItineraryJson, day: number, poiId: string) {
  const dayObj = itineraryJson.days.find((d) => d.day === day);
  const idx = dayObj?.stops.findIndex((s) => s.poi_id === poiId) ?? -1;
  return { date: dayObj?.date, ordinal: idx >= 0 ? idx + 1 : 1 };
}

/**
 * 매니징 제안 확인 모달 (design/artboards/AlertModal.dc.html / AlertExpiring.dc.html).
 * 3분 타임아웃을 로컬에서도 세서 남은 시간을 보여주고, 0이 되면 스스로 닫는다(PRD 6장) — 서버
 * cron이 실제로 dismissed 처리하는 것과 별개로, 열어둔 모달이 사용자 입력을 받지 않게 막는 역할.
 */
export function AlertModal({
  alert,
  itineraryJson,
  onRespond,
  onExpired,
}: {
  alert: AlertPayload;
  itineraryJson: ItineraryJson;
  onRespond: (response: "yes" | "no") => void;
  onExpired: () => void;
}) {
  const t = useTranslations("managing");
  const locale = useLocale() as UiLocale;
  const [remaining, setRemaining] = useState(() => {
    const elapsed = Math.floor((Date.now() - new Date(alert.triggered_at).getTime()) / 1000);
    return Math.max(0, TIMEOUT_SECONDS - elapsed);
  });

  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (remaining === 0) onExpired();
  }, [remaining, onExpired]);

  const { date, ordinal } = useMemo(
    () => findStopContext(itineraryJson, alert.proposed_stop.day, alert.proposed_stop.previous_poi_id),
    [itineraryJson, alert]
  );

  const previousStop = itineraryJson.days
    .find((d) => d.day === alert.proposed_stop.day)
    ?.stops.find((s) => s.poi_id === alert.proposed_stop.previous_poi_id);

  const message = localizedText(alert.message, locale);
  const candidate = alert.proposed_stop.candidate_poi;
  const isExpiring = remaining <= 30;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <Dialog open onOpenChange={(v) => !v && onRespond("no")}>
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-danger-bg">
            <CloudRain size={16} className="text-danger" strokeWidth={1.6} />
          </span>
          <div>
            <p className="text-[13px] font-bold tracking-tight">{t("proposalTitle")}</p>
            {date && (
              <p className="text-[11.5px] font-medium text-muted">
                {t("proposalMeta", { date: formatMonthDayWeekday(date, locale), ordinal })}
              </p>
            )}
          </div>
        </div>

        {message && <p className="mt-4 whitespace-pre-line text-[17px] font-bold leading-snug tracking-tight">{message}</p>}

        <div className="mt-4 space-y-2">
          {previousStop && (
            <CandidateRow
              label={t("now")}
              name={pickName(previousStop.name, locale).primary}
              sub={previousStop.is_indoor ? t("indoor") : t("outdoor")}
              category={previousStop.category}
              muted
            />
          )}
          <CandidateRow
            label={t("proposed")}
            name={pickName(candidate.name, locale).primary}
            sub={candidate.is_indoor ? t("indoor") : t("outdoor")}
            category={candidate.category}
          />
        </div>

        <p className="mt-4 text-center text-[12px] text-muted">{t("confirmHint")}</p>

        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={() => onRespond("no")}
            className="flex-1 rounded-2xl bg-bg-subtle py-3.5 text-[14.5px] font-bold text-ink-soft"
          >
            {t("no")}
          </button>
          <button
            type="button"
            onClick={() => onRespond("yes")}
            className="flex-1 rounded-2xl bg-brand py-3.5 text-[14.5px] font-bold text-white"
          >
            {t("yes")}
          </button>
        </div>

        <p className={"mt-4 text-center text-[11.5px] font-medium " + (isExpiring ? "text-danger" : "text-faint")}>
          {t("timeLeft", { time: `${minutes}:${String(seconds).padStart(2, "0")}` })} ·{" "}
          {isExpiring ? t("expiringHint") : t("timeLeftHint")}
        </p>
      </div>
    </Dialog>
  );
}

function CandidateRow({
  label,
  name,
  sub,
  category,
  muted,
}: {
  label: string;
  name: string;
  sub: string;
  category: Parameters<typeof CategoryIcon>[0]["category"];
  muted?: boolean;
}) {
  return (
    <div className={"flex items-center gap-3 rounded-2xl p-3 " + (muted ? "bg-bg-subtler opacity-70" : "bg-brand-bg")}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bg">
        <CategoryIcon category={category} size={18} />
      </span>
      <span className="min-w-0 flex-grow">
        <p className="truncate text-[14px] font-semibold">{name}</p>
        <p className="text-[11.5px] font-medium text-muted">{sub}</p>
      </span>
      <span
        className={
          "shrink-0 rounded-full px-2 py-1 text-[10.5px] font-bold " +
          (muted ? "bg-bg text-muted" : "bg-brand text-white")
        }
      >
        {label}
      </span>
    </div>
  );
}
