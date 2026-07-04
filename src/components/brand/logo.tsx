import { cn } from "@/lib/utils";
import Image from "next/image";

export function LogoMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo-512.png"
      alt="Mailslip"
      width={size}
      height={size}
      className={cn("rounded-[9px]", className)}
      priority
    />
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-[18px] font-semibold tracking-[-0.015em] text-text", className)}>
      Mail<span className="font-normal">slip</span>
    </span>
  );
}

export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <LogoWordmark />
    </div>
  );
}
