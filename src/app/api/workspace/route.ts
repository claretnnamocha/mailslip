import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getPrimaryWorkspace, isAdminRole } from "@/lib/identities";
import {
  isValidSlug,
  normalizeSlug,
  platformHosts,
  tenantBaseDomain,
  tenantHostFromSlug,
} from "@/lib/tenant";
import { cnameTarget } from "@/lib/cname-target";
import {
  normalizePlan,
  workspaceAllowsCustomDomain,
} from "@/lib/billing";
import {
  cloudflareSaasConfigured,
  deleteCustomHostname,
  ensureCustomHostname,
  getCustomHostnameStatus,
} from "@/lib/cloudflare-saas";

function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

async function workspacePayload(
  workspace: {
    id: string;
    name: string;
    slug: string | null;
    brandName: string | null;
    customDomain: string | null;
    mode: string;
    plan: string;
  },
  role: string,
) {
  const plan = normalizePlan(workspace.plan);
  const allowsByod = workspaceAllowsCustomDomain(workspace);
  const domainStatus =
    workspace.customDomain && cloudflareSaasConfigured()
      ? await getCustomHostnameStatus(workspace.customDomain)
      : null;
  const base = tenantBaseDomain();

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    brandName: workspace.brandName,
    customDomain: workspace.customDomain,
    mode: workspace.mode,
    plan,
    allowsCustomDomain: allowsByod,
    role,
    platformHosts: platformHosts(),
    tenantBaseDomain: base,
    slugHost: workspace.slug ? tenantHostFromSlug(workspace.slug) : null,
    cnameTarget: cnameTarget(),
    cloudflareSaas: cloudflareSaasConfigured(),
    domainStatus,
  };
}

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership) return jsonError("No workspace", 404);

  return NextResponse.json(
    await workspacePayload(membership.workspace, membership.role),
  );
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  brandName: z.string().trim().max(80).optional().nullable(),
  slug: z.string().trim().max(63).optional().nullable(),
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
    slug?: string | null;
    customDomain?: string | null;
    mode?: string;
  } = {};

  const previousDomain = membership.workspace.customDomain;

  if (body.name !== undefined) data.name = body.name;
  if (body.brandName !== undefined) {
    data.brandName = body.brandName?.trim() || null;
  }

  if (body.slug !== undefined) {
    const slug = body.slug ? normalizeSlug(body.slug) : "";
    if (!slug) {
      data.slug = null;
    } else {
      if (!isValidSlug(slug)) {
        return jsonError(
          "Slug must be 2–63 chars, lowercase letters/numbers/hyphens (e.g. gbese)",
        );
      }
      const taken = await prisma.workspace.findFirst({
        where: {
          slug,
          NOT: { id: membership.workspaceId },
        },
      });
      if (taken) return jsonError("That slug is already taken", 409);
      data.slug = slug;
    }
  }

  if (body.customDomain !== undefined) {
    const domain = body.customDomain ? normalizeDomain(body.customDomain) : "";
    if (!domain) {
      data.customDomain = null;
    } else {
      const attachingNew =
        domain !== previousDomain && !workspaceAllowsCustomDomain(membership.workspace);
      if (attachingNew) {
        return jsonError(
          "Custom domains are a paid feature. Upgrade to attach your own domain.",
          402,
        );
      }
      if (!domain.includes(".") || domain.includes(" ")) {
        return jsonError("Enter a valid hostname, e.g. mail.acme.com");
      }
      if (platformHosts().includes(domain) || domain === cnameTarget()) {
        return jsonError("That host is reserved for the Mailslip platform");
      }
      if (domain === tenantBaseDomain() || domain.endsWith(`.${tenantBaseDomain()}`)) {
        return jsonError("Use the workspace slug for *.mailslip hosts, not custom domain");
      }
      const taken = await prisma.workspace.findFirst({
        where: {
          customDomain: domain,
          NOT: { id: membership.workspaceId },
        },
      });
      if (taken) return jsonError("That domain is already used by another workspace", 409);
      data.customDomain = domain;
    }
  }

  if (body.slug !== undefined || body.customDomain !== undefined) {
    const nextSlug =
      data.slug !== undefined ? data.slug : membership.workspace.slug;
    const nextDomain =
      data.customDomain !== undefined
        ? data.customDomain
        : membership.workspace.customDomain;
    data.mode = nextSlug || nextDomain ? "self-hosted" : "cloud";
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

  return NextResponse.json(await workspacePayload(workspace, membership.role));
}
