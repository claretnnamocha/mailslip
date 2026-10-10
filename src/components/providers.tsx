"use client";

import { createContext, useContext, useEffect } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { DialogProvider } from "@/components/dialog-provider";
import type { HostingMode } from "@/lib/hosting";
import { clientSignOut } from "@/lib/client-sign-out";
import { Toaster } from "sonner";

const HostingContext = createContext<HostingMode>("cloud");
const BrandContext = createContext("Mailslip");

export function useHostingMode() {
  return useContext(HostingContext);
}

export function useBrandName() {
  return useContext(BrandContext);
}

/**
 * After a Node session refresh finds the user row gone, Auth returns no id.
 * Wait until the session has finished loading so we don't race a fresh login.
 */
function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (session?.user?.id) return;
    void clientSignOut("/login");
  }, [status, session?.user?.id]);

  return <>{children}</>;
}

export function Providers({
  children,
  hosting,
  brand = "Mailslip",
}: {
  children: React.ReactNode;
  hosting: HostingMode;
  brand?: string;
}) {
  return (
    <HostingContext.Provider value={hosting}>
      <BrandContext.Provider value={brand}>
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
      </BrandContext.Provider>
    </HostingContext.Provider>
  );
}
