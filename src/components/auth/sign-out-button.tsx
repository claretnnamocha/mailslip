"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOutIcon } from "@/components/mail/icons";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  variant?: "sidebar" | "button";
};

/**
 * Clears the Auth.js session cookie and returns to the landing page.
 * Dev credentials: session ends immediately.
 * Zitadel: Mailslip session ends; configure post-logout redirect on the
 * Zitadel app if you also want the IdP session cleared.
 */
export function SignOutButton({ className, variant = "button" }: Props) {
  function handleSignOut() {
    void signOut({ callbackUrl: "/" });
  }

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] text-text-2 transition-colors hover:bg-hover hover:text-text",
          className,
        )}
      >
        <LogOutIcon size={16} />
        Sign out
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleSignOut}
      className={className}
    >
      <LogOutIcon size={16} />
      Sign out
    </Button>
  );
}
