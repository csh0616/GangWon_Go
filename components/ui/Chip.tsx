import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/app/lib/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  /** 순차 오픈 예정처럼 아예 고를 수 없는 상태 (design/README.md .rchip.off) */
  unavailable?: boolean;
};

/** 지역/동행 유형 등에 쓰는 알약형 선택 칩 (design/README.md .rchip/.chip) */
export function Chip({ selected, unavailable, className, disabled, ...props }: Props) {
  return (
    <button
      type="button"
      disabled={disabled || unavailable}
      aria-pressed={selected}
      className={cn(
        "flex h-11 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-semibold tracking-tight transition-colors",
        !unavailable && selected && "bg-brand font-bold text-white",
        !unavailable && !selected && "bg-bg-subtle text-ink-soft hover:bg-bg-subtler",
        unavailable && "cursor-not-allowed bg-bg-faint font-medium text-disabled",
        className
      )}
      {...props}
    />
  );
}
