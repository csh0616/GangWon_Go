import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/app/lib/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  /**
   * 시각적으로만 "비어있음" 톤을 보여주고 클릭은 계속 받는다 — 실제 disabled 속성을 걸면
   * 클릭이 막혀 검증(빠진 값 안내)을 촉발할 방법이 없어진다(P0-2, 2026-09-12 PM 검수).
   * 진짜로 클릭 자체를 막고 싶으면 disabled를 그대로 쓰면 된다.
   */
  visuallyEmpty?: boolean;
};

/** design/README.md .btn 사양: 56px 높이, 14px 라운드 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", disabled, visuallyEmpty, ...props },
  ref
) {
  const looksEmpty = disabled || visuallyEmpty;
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "flex h-14 w-full items-center justify-center rounded-2xl text-base font-bold tracking-tight transition-colors",
        variant === "primary" &&
          (looksEmpty
            ? "bg-bg-subtle text-disabled"
            : "bg-brand text-white hover:bg-brand-hover active:bg-brand-hover"),
        variant === "secondary" &&
          "bg-bg-subtle text-ink-soft hover:bg-bg-subtler",
        variant === "ghost" && "bg-transparent text-ink-soft hover:bg-bg-subtle",
        className
      )}
      {...props}
    />
  );
});
