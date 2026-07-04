"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DialogTone = "default" | "danger";

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  showCancel?: boolean;
  input?: {
    label?: string;
    placeholder?: string;
    defaultValue?: string;
    type?: string;
  };
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function Dialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  showCancel = true,
  input,
  inputValue,
  onInputChange,
  onConfirm,
  onCancel,
}: DialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusTarget = input ? inputRef.current : confirmRef.current;
    focusTarget?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, input, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(28,27,25,0.36)] backdrop-blur-[2px]"
        aria-label="Dismiss dialog"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[420px] rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)]"
      >
        <h2 id={titleId} className="text-[18px] font-semibold tracking-[-0.02em] text-text">
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-[14px] leading-relaxed text-text-2">{description}</p>
        )}
        {input && (
          <label className="mt-4 block">
            {input.label && (
              <span className="mb-2 block text-[13px] font-medium text-text-2">
                {input.label}
              </span>
            )}
            <input
              ref={inputRef}
              type={input.type || "text"}
              value={inputValue}
              onChange={(e) => onInputChange?.(e.target.value)}
              placeholder={input.placeholder}
              className={cn(
                "h-[46px] w-full rounded-[11px] border border-border-strong bg-surface px-3.5 text-[14px] text-text",
                "focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)]",
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onConfirm();
                }
              }}
            />
          </label>
        )}
        <div className="mt-6 flex justify-end gap-2">
          {showCancel && (
            <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button
            ref={confirmRef}
            type="button"
            size="sm"
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
