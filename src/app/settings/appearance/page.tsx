"use client";

import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export default function AppearanceSettingsPage() {
  const { theme, setTheme, density, setDensity } = useTheme();

  return (
    <div>
      <h1 className="text-[27px] font-semibold tracking-[-0.02em]">Appearance</h1>
      <p className="mt-2 text-[15px] text-text-2">
        Light, dark, or system. Email content stays on a white sheet either way.
      </p>

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="text-[15px] font-semibold">Theme</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["light", "dark", "system"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "rounded-[10px] border px-4 py-2.5 text-[13.5px] capitalize",
                  theme === value
                    ? "border-accent bg-accent-tint"
                    : "border-border-strong bg-surface hover:bg-hover",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold">Density</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["comfortable", "compact"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setDensity(value)}
                className={cn(
                  "rounded-[10px] border px-4 py-2.5 text-[13.5px] capitalize",
                  density === value
                    ? "border-accent bg-accent-tint"
                    : "border-border-strong bg-surface hover:bg-hover",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="text-[15px] font-semibold">Email sheet preview</div>
          <div className="mt-4 rounded-[11px] border border-border bg-email-sheet p-4 text-email-body">
            <div className="font-semibold text-email-text">Your onboarding docs</div>
            <p className="mt-1 text-[13px] leading-relaxed">
              Everything for your first week is attached. Shout if anything&apos;s unclear.
            </p>
          </div>
          <p className="mt-3 text-[12px] text-text-3">
            Keep email white in dark mode is always on — like a physical letter.
          </p>
        </section>
      </div>
    </div>
  );
}
