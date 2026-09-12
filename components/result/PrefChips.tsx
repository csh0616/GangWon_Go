"use client";

import { useTranslations } from "next-intl";
import { topPreferenceChips } from "@/app/lib/weights";
import type { PreferenceWeights } from "@/app/lib/types";

/**
 * "반영한 취향" 칩 (확정 규칙): 0.5 이상, 최대 3개, 내림차순. 해당 없으면 영역 자체를 렌더링하지
 * 않는다 (design/artboards/ResultNoPref.dc.html) — 그래서 이 컴포넌트는 null을 반환할 수 있다.
 */
export function PrefChips({ weights }: { weights: PreferenceWeights | null | undefined }) {
  const t = useTranslations("result");
  const tc = useTranslations("categories");
  const top = topPreferenceChips(weights);

  if (top.length === 0) return null;

  return (
    <div className="mt-3.5 flex items-center gap-1.5">
      <span className="text-[11.5px] font-medium text-muted">{t("prefTitle")}</span>
      {top.map((cat) => (
        <span
          key={cat}
          className="flex h-[26px] items-center rounded-full bg-brand-bg px-2.5 text-[11.5px] font-bold text-brand"
        >
          {tc(cat)}
        </span>
      ))}
    </div>
  );
}
