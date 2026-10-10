import { NextResponse } from "next/server";
import { resolveHosting } from "@/lib/hosting";
import { getRequestHost, platformHosts } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const host = await getRequestHost();
  const { context, tenant, mode, brand, allowSignup, isPlatform } = await resolveHosting();
  return NextResponse.json({
    host,
    mode,
    allowSignup,
    brand,
    isPlatform,
    platformHosts: platformHosts(),
    kind: context.kind,
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          brandName: tenant.brandName,
          customDomain: tenant.customDomain,
        }
      : null,
  });
}
