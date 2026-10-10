"use client";

import { createContext, useContext, useEffect } from "react";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { DialogProvider } from "@/components/dialog-provider";
import type { HostingMode } from "@/lib/hosting";
import { Toaster } from "sonner";

const HostingContext = createContext<HostingMode>("cloud");

export function useHostingMode() {
  return useContext(HostingContext);
}

/** Clears the cookie when the JWT outlives a deleted account. */
function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && !session?.user?.id) {
      void signOut({ callbackUrl: "/login" });
    }
  }, [status, session?.user?.id]);

  return <>{children}</>;
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
      <SessionProvider refetchInterval={60} refetchOnWindowFocus>
        <SessionGuard>
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
        </SessionGuard>
      </SessionProvider>
    </HostingContext.Provider>
  );
}
