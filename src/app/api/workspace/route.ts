import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getPrimaryWorkspace, isAdminRole } from "@/lib/identities";
import { platformHosts } from "@/lib/tenant";
import { cnameTarget } from "@/lib/cname-target";
import {
  cloudflareSaasConfigured,
  deleteCustomHostname,
  ensureCustomHostname,
} from "@/lib/cloudflare-saas";

function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

function workspacePayload(
  workspace: {
    id: string;
    name: string;
    brandName: string | null;
    customDomain: string | null;
    mode: string;
  },
  role: string,
) {
  return {
    id: workspace.id,
    name: workspace.name,
    brandName: workspace.brandName,
    customDomain: workspace.customDomain,
    mode: workspace.mode,
    role,
    platformHosts: platformHosts(),
    cnameTarget: cnameTarget(),
    cloudflareSaas: cloudflareSaasConfigured(),
  };
}

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership) return jsonError("No workspace", 404);

  return NextResponse.json(workspacePayload(membership.workspace, membership.role));
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

  const previousDomain = membership.workspace.customDomain;

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
      if (platformHosts().includes(domain) || domain === cnameTarget()) {
        return jsonError("That host is reserved for the Mailslip platform");
      }
      const taken = await prisma.workspace.findFirst({
        where: {
          customDomain: domain,
          NOT: { id: membership.workspaceId },
        },
      });
      if (taken) return jsonError("That domain is already used by another workspace", 409);
      data.customDomain = domain;
      data.mode = "self-hosted";
    }
  }

  if (body.customDomain !== undefined && cloudflareSaasConfigured()) {
    const next = data.customDomain ?? null;
    if (previousDomain && previousDomain !== next) {
      const removed = await deleteCustomHostname(previousDomain);
      if (!removed.skipped && !removed.ok) {
        return jsonError(`Could not release old domain on Cloudflare: ${removed.error}`);
      }
    }
    if (next) {
      const ensured = await ensureCustomHostname(next);
      if (!ensured.skipped && !ensured.ok) {
        return jsonError(`Could not register domain on Cloudflare: ${ensured.error}`);
      }
    }
  }

  const workspace = await prisma.workspace.update({
    where: { id: membership.workspaceId },
    data,
  });

  return NextResponse.json(workspacePayload(workspace, membership.role));
}
