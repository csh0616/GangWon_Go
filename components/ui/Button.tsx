import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/app/lib/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

/** design/README.md .btn 사양: 56px 높이, 14px 라운드 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "flex h-14 w-full items-center justify-center rounded-2xl text-base font-bold tracking-tight transition-colors",
        variant === "primary" &&
          (disabled
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
