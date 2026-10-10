"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, ReactNode, forwardRef, useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/mail/icons";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: ReactNode;
  error?: string;
  mono?: boolean;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, label, hint, error, mono, id, type = "text", ...props },
  ref,
) {
  const inputId = id || props.name;
  const isPassword = type === "password";
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      {label && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-medium text-text-2">{label}</span>
          {hint}
        </div>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={isPassword && visible ? "text" : type}
          className={cn(
            "h-[46px] w-full rounded-[11px] border border-border-strong bg-surface px-3.5 text-[14px] text-text placeholder:text-text-3 transition-shadow duration-150",
            "focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)]",
            isPassword && "pr-11",
            error && "border-danger",
            mono && "mono",
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible((value) => !value)}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1.5 text-text-3 hover:bg-hover hover:text-text"
          >
            {visible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-[13px] text-danger">{error}</p>}
    </label>
  );
});
