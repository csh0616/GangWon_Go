"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** design/artboards/SavedDone.dc.html 상단 한 줄 안내 — 도착 직후 잠깐 보였다 사라진다 */
export function SavedToast() {
  const t = useTranslations("save");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;

  return (
    <div className="flex h-[38px] items-center justify-center bg-brand-bg px-4 text-center text-[12.5px] font-semibold text-brand-hover">
      {t("savedDoneHeaderNote")}
    </div>
  );
}
