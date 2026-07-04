import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getPrimaryWorkspace, isAdminRole } from "@/lib/identities";

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership) return jsonError("No workspace");

  const domains = await prisma.domain.findMany({
    where: { workspaceId: membership.workspaceId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(domains);
}

const schema = z.object({
  domain: z.string().min(3),
});

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership || !isAdminRole(membership.role)) {
    return jsonError("Forbidden", 403);
  }

  const body = schema.parse(await request.json());
  const domainName = body.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

  const claimed = await prisma.domain.findUnique({ where: { domain: domainName } });
  if (claimed) {
    return jsonError(
      `Domain already claimed by another workspace. Request a transfer from the current owner.`,
      409,
    );
  }

  const domain = await prisma.domain.create({
    data: {
      workspaceId: membership.workspaceId,
      domain: domainName,
      verificationToken: `mailslip-verify=${randomBytes(16).toString("hex")}`,
    },
  });

  return NextResponse.json(domain);
}
