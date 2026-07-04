import { cn } from "@/lib/utils";
import { InputHTMLAttributes, ReactNode, forwardRef } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: ReactNode;
  error?: string;
  mono?: boolean;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, label, hint, error, mono, id, ...props },
  ref,
) {
  const inputId = id || props.name;
  return (
    <label className="block">
      {label && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-medium text-text-2">{label}</span>
          {hint}
        </div>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "h-[46px] w-full rounded-[11px] border border-border-strong bg-surface px-3.5 text-[14px] text-text placeholder:text-text-3 transition-shadow duration-150",
          "focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)]",
          error && "border-danger",
          mono && "mono",
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-[13px] text-danger">{error}</p>}
    </label>
  );
});
