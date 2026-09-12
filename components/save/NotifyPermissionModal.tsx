"use client";

import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

/**
 * design/artboards/NotifyPermission.dc.html. 코스를 저장한 직후에만 묻는다(PRD 6장) — 앱 진입
 * 즉시 묻지 않음. Service Worker/웹 푸시는 쓰지 않고 페이지가 열려있는 동안만 동작하는
 * Notification API만 사용(같은 문서 확정 사항).
 */
export function NotifyPermissionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("save");

  function handleAllow() {
    if (typeof Notification !== "undefined") {
      Notification.requestPermission().finally(onClose);
    } else {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <div className="p-6 text-center">
        <h2 className="whitespace-pre-line text-xl font-bold leading-snug tracking-tight">
          {t("notifyTitle")}
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-muted">{t("notifyBody")}</p>
        <div className="mt-6">
          <Button onClick={handleAllow}>{t("notifyAction")}</Button>
          <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-[13px] font-semibold text-muted">
            {t("later")}
          </button>
        </div>
        <p className="mt-4 text-[11px] text-faint">{t("notifyFootnote")}</p>
      </div>
    </Dialog>
  );
}
