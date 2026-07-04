import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  return NextResponse.json(await prisma.filterRule.findMany({ where: { userId: authResult.userId } }));
}

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const body = await request.json();
  const sieveScript = `require ["fileinto"];\nif header :contains "${body.conditions.field}" "${body.conditions.value}" { fileinto "${body.actions.target}"; }`;
  const rule = await prisma.filterRule.create({
    data: {
      userId: authResult.userId,
      identityId: body.identityId,
      name: body.name,
      conditions: body.conditions,
      actions: body.actions,
      sieveScript,
    },
  });
  return NextResponse.json(rule);
}
