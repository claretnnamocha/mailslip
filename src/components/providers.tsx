"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <Toaster
          position="bottom-left"
          toastOptions={{
            className: "!bg-surface !text-text !border-border !shadow-[var(--shadow)]",
          }}
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
