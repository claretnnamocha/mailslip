import { NextResponse } from "next/server";
import { allowsPublicSignup, brandName, hostingMode } from "@/lib/hosting";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    mode: hostingMode(),
    allowSignup: allowsPublicSignup(),
    brand: brandName(),
  });
}
