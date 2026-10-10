"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type MenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
  submenu?: MenuItem[];
  /** Custom row (e.g. flag swatches) — still clickable via onSelect on parent */
  custom?: ReactNode;
  onSelect?: () => void;
};

type MenuProps = {
  open: boolean;
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
  className?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function Menu({ open, x, y, items, onClose, className }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [submenuId, setSubmenuId] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      left: clamp(x, 8, window.innerWidth - rect.width - 8),
      top: clamp(y, 8, window.innerHeight - rect.height - 8),
    });
  }, [open, x, y, items]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    function onPointer(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setSubmenuId(null);
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="menu"
      className={cn(
        "fixed z-[80] min-w-[220px] rounded-[12px] border border-border bg-surface py-1.5 shadow-[var(--shadow)]",
        className,
      )}
      style={{ left: pos.left, top: pos.top }}
    >
      {items.map((item) => (
        <div key={item.id}>
          {item.separatorBefore && <div className="my-1.5 h-px bg-border" />}
          {item.custom ? (
            <div className="px-2 py-1.5">{item.custom}</div>
          ) : item.submenu ? (
            <div
              className="relative"
              onMouseEnter={() => setSubmenuId(item.id)}
              onMouseLeave={() => setSubmenuId((id) => (id === item.id ? null : id))}
            >
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-text hover:bg-hover disabled:opacity-40",
                  item.danger && "text-danger",
                )}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                <span className="text-text-3">›</span>
              </button>
              {submenuId === item.id && (
                <div className="absolute left-full top-0 z-[81] ml-1 min-w-[180px] rounded-[12px] border border-border bg-surface py-1.5 shadow-[var(--shadow)]">
                  {item.submenu.map((sub) => (
                    <div key={sub.id}>
                      {sub.separatorBefore && <div className="my-1.5 h-px bg-border" />}
                      {sub.custom ? (
                        <div className="px-2 py-1.5">{sub.custom}</div>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          disabled={sub.disabled}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-text hover:bg-hover disabled:opacity-40",
                            sub.danger && "text-danger",
                          )}
                          onClick={() => {
                            if (sub.disabled) return;
                            sub.onSelect?.();
                            onClose();
                          }}
                        >
                          {sub.icon}
                          <span className="flex-1">{sub.label}</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-text hover:bg-hover disabled:opacity-40",
                item.danger && "text-danger",
              )}
              onClick={() => {
                if (item.disabled) return;
                item.onSelect?.();
                onClose();
              }}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function useMenu() {
  const [state, setState] = useState<{ x: number; y: number; items: MenuItem[] } | null>(
    null,
  );

  function openAt(x: number, y: number, items: MenuItem[]) {
    setState({ x, y, items });
  }

  function openFromEvent(e: { clientX: number; clientY: number; preventDefault: () => void }, items: MenuItem[]) {
    e.preventDefault();
    openAt(e.clientX, e.clientY, items);
  }

  function close() {
    setState(null);
  }

  return {
    open: Boolean(state),
    x: state?.x ?? 0,
    y: state?.y ?? 0,
    items: state?.items ?? [],
    openAt,
    openFromEvent,
    close,
  };
}
