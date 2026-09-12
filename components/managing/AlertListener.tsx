"use client";

import { useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useWatch } from "./WatchContext";
import { AlertBanner } from "./AlertBanner";
import { localizedText, type UiLocale } from "@/app/lib/localized";

/**
 * 전역 매니징 알림 리스너 (PRD 6장). 코스 화면(/itinerary/:id) 위에 있으면 그 화면이 직접
 * AlertModal을 그리므로 배너를 띄우지 않는다. 그 외 화면에서는 배너를 띄우고, 탭이 백그라운드일
 * 때만 브라우저 Notification API를 보조로 함께 사용한다(둘 다 배너를 대체하지 않음, PRD 6장).
 */
export function AlertListener() {
  const { watchedId, pendingAlert } = useWatch();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("managing");
  const firedForRef = useRef<string | null>(null);

  const onItineraryPage = watchedId ? pathname === `/itinerary/${watchedId}` : false;

  useEffect(() => {
    if (!pendingAlert || firedForRef.current === pendingAlert.alert_id) return;
    firedForRef.current = pendingAlert.alert_id;

    if (typeof document !== "undefined" && document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(localizedText(pendingAlert.message, locale as UiLocale) ?? "GANGWON GO", {
          body: t("bannerText"),
        });
      } catch {
        // 알림 생성 실패는 조용히 무시 — 앱 내 배너가 항상 폴백
      }
    }
  }, [pendingAlert, locale, t]);

  if (!pendingAlert || onItineraryPage) return null;

  return (
    <AlertBanner
      onClick={() => {
        if (watchedId) router.push(`/itinerary/${watchedId}`);
      }}
    />
  );
}
