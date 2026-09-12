"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Header } from "@/components/layout/Header";
import { ResultView } from "@/components/result/ResultView";
import { AlertModal } from "@/components/managing/AlertModal";
import { ReplaceStopModal } from "@/components/edit/ReplaceStopModal";
import { NotifyPermissionModal } from "@/components/save/NotifyPermissionModal";
import { SavedToast } from "@/components/save/SavedToast";
import { useWatch } from "@/components/managing/WatchContext";
import { getItinerary, respondAlert, triggerAlert } from "@/app/lib/api";
import { consumeJustSaved } from "@/app/lib/storage";
import { todayYmd } from "@/app/lib/date";
import { pickName, type UiLocale } from "@/app/lib/localized";
import type { RegionCode, SavedItineraryDetail, Stop } from "@/app/lib/types";

type EditTarget = { day: number; date: string; ordinal: number; stop: Stop; region: RegionCode };

export default function ItineraryPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("notFound");
  const tm = useTranslations("managing");
  const locale = useLocale() as UiLocale;
  const { setWatchedId, pendingAlert, clearAlert } = useWatch();

  const [detail, setDetail] = useState<SavedItineraryDetail | "loading" | "not_found">("loading");
  const [showToast, setShowToast] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [changedStopId, setChangedStopId] = useState<string | null>(null);
  const [expiredToast, setExpiredToast] = useState(false);
  const [appliedName, setAppliedName] = useState<string | null>(null);

  useEffect(() => {
    setWatchedId(id);
    getItinerary(id).then((res) => {
      setDetail(res.data ?? "not_found");
    });
    if (consumeJustSaved(id)) {
      // sessionStorage 플래그는 SSR에 없으므로 마운트 후에만 확인 가능
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowToast(true);
      setNotifyOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 개발 전용 테스트 훅 — PRD 3.5절: 강제 트리거는 UI 버튼이 아니라 API 직접 호출로만 검증한다
  // (TEST_PLAN.md T-003/T-007/T-008). 실서비스 빌드에는 포함되지 않는다.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || detail === "loading" || detail === "not_found") return;
    const firstDay = detail.itinerary_json.days.find((d) => d.stops.length > 0);
    const firstStop = firstDay?.stops[0];
    if (!firstDay || !firstStop) return;
    (window as unknown as Record<string, unknown>).__ggoTriggerAlert = () =>
      triggerAlert(id, firstDay.day, firstStop.poi_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  if (detail === "loading") return null;

  if (detail === "not_found") {
    return (
      <div className="flex min-h-dvh flex-col">
        <Header />
        <div className="flex flex-grow flex-col items-center justify-center px-5 text-center">
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <p className="mt-2 text-sm text-muted">{t("body")}</p>
        </div>
      </div>
    );
  }

  const today = todayYmd();
  const isWatching = detail.start_date <= today && today <= detail.end_date;
  const excludeIds = detail.itinerary_json.days.flatMap((d) => d.stops.map((s) => s.poi_id));

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      {showToast && <SavedToast />}
      {appliedName && (
        <div className="flex h-[38px] items-center justify-center bg-brand-bg px-4 text-center text-[12.5px] font-semibold text-brand-hover">
          {tm("appliedToast", { name: appliedName })}
        </div>
      )}
      <div className="flex-grow">
        <ResultView
          itineraryJson={detail.itinerary_json}
          selectedRegions={{ auto: false, region_codes: detail.region_codes }}
          preferenceWeights={detail.preference_weights}
          startDate={detail.start_date}
          endDate={detail.end_date}
          companions={detail.companions}
          relationship={detail.relationship}
          status={isWatching ? "watching" : "saved"}
          editable
          changedStopId={changedStopId}
          onSwapStop={(day, poiId, region) => {
            const dayObj = detail.itinerary_json.days.find((d) => d.day === day);
            const idx = dayObj?.stops.findIndex((s) => s.poi_id === poiId) ?? -1;
            const stop = dayObj?.stops[idx];
            if (!dayObj || !stop) return;
            setEditTarget({ day, date: dayObj.date, ordinal: idx + 1, stop, region });
          }}
        />
      </div>

      {pendingAlert && pendingAlert.itinerary_id === id && (
        <AlertModal
          alert={pendingAlert}
          itineraryJson={detail.itinerary_json}
          onExpired={() => {
            clearAlert();
            setExpiredToast(true);
            setTimeout(() => setExpiredToast(false), 3000);
          }}
          onRespond={async (response) => {
            const res = await respondAlert(pendingAlert.alert_id, response);
            if (res.data?.status === "confirmed" && res.data.updated_stop) {
              const newPoiId = res.data.updated_stop.poi_id;
              setDetail((prev) => {
                if (!prev || prev === "loading" || prev === "not_found") return prev;
                const candidate = pendingAlert.proposed_stop.candidate_poi;
                return {
                  ...prev,
                  itinerary_json: {
                    ...prev.itinerary_json,
                    days: prev.itinerary_json.days.map((d) =>
                      d.day !== pendingAlert.proposed_stop.day
                        ? d
                        : {
                            ...d,
                            stops: d.stops.map((s) =>
                              s.poi_id === pendingAlert.proposed_stop.previous_poi_id
                                ? {
                                    ...s,
                                    poi_id: candidate.poi_id,
                                    name: candidate.name,
                                    category: candidate.category,
                                    is_indoor: candidate.is_indoor,
                                    lat: candidate.lat,
                                    lng: candidate.lng,
                                    // alerts payload에는 blurb가 없다(API_CONTRACT.md §3) — 지어내지 않고 줄을 비운다
                                    blurb: null,
                                  }
                                : s
                            ),
                          }
                    ),
                  },
                };
              });
              setChangedStopId(newPoiId);
              setTimeout(() => setChangedStopId(null), 6000);
              setAppliedName(pickName(pendingAlert.proposed_stop.candidate_poi.name, locale).primary);
              setTimeout(() => setAppliedName(null), 5000);
            }
            clearAlert();
          }}
        />
      )}

      {expiredToast && (
        <div className="fixed inset-x-4 bottom-4 z-50 rounded-2xl bg-ink px-4 py-3 text-center text-[13px] font-semibold text-white">
          {tm("expiredToast")}
        </div>
      )}

      {editTarget && (
        <ReplaceStopModal
          open
          onClose={() => setEditTarget(null)}
          itineraryId={id}
          day={editTarget.day}
          date={editTarget.date}
          ordinal={editTarget.ordinal}
          targetStop={editTarget.stop}
          region={editTarget.region}
          excludePoiIds={excludeIds}
          onConfirmed={(newPoiId) => {
            getItinerary(id).then((res) => {
              if (!res.data) return;
              setDetail(res.data);
              const newStop = res.data.itinerary_json.days
                .flatMap((d) => d.stops)
                .find((s) => s.poi_id === newPoiId);
              if (newStop) {
                setAppliedName(pickName(newStop.name, locale).primary);
                setTimeout(() => setAppliedName(null), 5000);
              }
            });
            setChangedStopId(newPoiId);
            setEditTarget(null);
            setTimeout(() => setChangedStopId(null), 6000);
          }}
        />
      )}

      <NotifyPermissionModal open={notifyOpen} onClose={() => setNotifyOpen(false)} />
    </div>
  );
}
