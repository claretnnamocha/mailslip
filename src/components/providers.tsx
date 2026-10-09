"use client";

import { createContext, useContext } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { DialogProvider } from "@/components/dialog-provider";
import type { HostingMode } from "@/lib/hosting";
import { Toaster } from "sonner";

const HostingContext = createContext<HostingMode>("cloud");

export function useHostingMode() {
  return useContext(HostingContext);
}

export function Providers({
  children,
  hosting,
}: {
  children: React.ReactNode;
  hosting: HostingMode;
}) {
  return (
    <HostingContext.Provider value={hosting}>
      <SessionProvider>
        <ThemeProvider>
          <DialogProvider>
            {children}
            <Toaster
              position="bottom-left"
              toastOptions={{
                className: "!bg-surface !text-text !border-border !shadow-[var(--shadow)]",
              }}
            />
          </DialogProvider>
        </ThemeProvider>
      </SessionProvider>
    </HostingContext.Provider>
  );
}
