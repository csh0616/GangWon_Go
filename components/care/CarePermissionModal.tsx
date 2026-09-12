"use client";

import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

/** design/artboards/CarePermission.dc.html — navigator.geolocation 실제 권한 요청 직전 설명 모달 */
export function CarePermissionModal({
  open,
  onClose,
  onAllow,
}: {
  open: boolean;
  onClose: () => void;
  onAllow: () => void;
}) {
  const t = useTranslations("care");
  const tc = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <div className="p-6 text-center">
        <h2 className="whitespace-pre-line text-xl font-bold leading-snug tracking-tight">
          {t("permissionTitle")}
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-muted">{t("permissionBody")}</p>
        <p className="mt-3 text-xs leading-relaxed text-faint">{t("permissionPrivacy")}</p>
        <div className="mt-6">
          <Button onClick={onAllow}>{t("permissionAllow")}</Button>
          <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-[13px] font-semibold text-muted">
            {tc("later")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
