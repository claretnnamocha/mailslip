import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-[0_2px_10px_rgba(190,124,94,0.30)] hover:bg-accent-press",
  secondary:
    "bg-surface text-text border border-border-strong hover:bg-hover",
  ghost: "bg-transparent text-text-2 hover:bg-hover hover:text-text",
  danger: "bg-transparent text-danger border border-danger hover:bg-danger/10",
  dark: "bg-text text-bg hover:opacity-90",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[11px] font-medium transition-colors duration-150 ease-out disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" && "h-9 px-3 text-[13px]",
        size === "md" && "h-[46px] px-5 text-[15px]",
        size === "lg" && "h-12 px-6 text-[15px]",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
});
