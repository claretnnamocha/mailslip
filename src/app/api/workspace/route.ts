import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getPrimaryWorkspace, isAdminRole } from "@/lib/identities";
import { platformHosts } from "@/lib/tenant";

function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership) return jsonError("No workspace", 404);

  const workspace = membership.workspace;
  return NextResponse.json({
    id: workspace.id,
    name: workspace.name,
    brandName: workspace.brandName,
    customDomain: workspace.customDomain,
    mode: workspace.mode,
    role: membership.role,
    platformHosts: platformHosts(),
  });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  brandName: z.string().trim().max(80).optional().nullable(),
  customDomain: z.string().trim().max(253).optional().nullable(),
});

export async function PATCH(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership || !isAdminRole(membership.role)) {
    return jsonError("Only owners and admins can change workspace hosting", 403);
  }

  const body = patchSchema.parse(await request.json());
  const data: {
    name?: string;
    brandName?: string | null;
    customDomain?: string | null;
    mode?: string;
  } = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.brandName !== undefined) {
    data.brandName = body.brandName?.trim() || null;
  }
  if (body.customDomain !== undefined) {
    const domain = body.customDomain ? normalizeDomain(body.customDomain) : "";
    if (!domain) {
      data.customDomain = null;
      data.mode = "cloud";
    } else {
      if (!domain.includes(".") || domain.includes(" ")) {
        return jsonError("Enter a valid hostname, e.g. mail.acme.com");
      }
      if (platformHosts().includes(domain)) {
        return jsonError("That host is reserved for the Mailslip platform entry");
      }
      const taken = await prisma.workspace.findFirst({
        where: {
          customDomain: domain,
          NOT: { id: membership.workspaceId },
        },
      });
      if (taken) return jsonError("That domain is already used by another workspace", 409);
      data.customDomain = domain;
      // Custom domain hosts always behave like self-hosted.
      data.mode = "self-hosted";
    }
  }

  const workspace = await prisma.workspace.update({
    where: { id: membership.workspaceId },
    data,
  });

  return NextResponse.json({
    id: workspace.id,
    name: workspace.name,
    brandName: workspace.brandName,
    customDomain: workspace.customDomain,
    mode: workspace.mode,
    role: membership.role,
    platformHosts: platformHosts(),
  });
}
