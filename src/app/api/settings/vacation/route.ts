import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const body = await request.json();
  const rule = await prisma.vacationRule.create({
    data: {
      userId: authResult.userId,
      identityId: body.identityId,
      enabled: body.enabled ?? true,
      subject: body.subject,
      body: body.body,
      contactsOnly: body.contactsOnly ?? false,
    },
  });
  return NextResponse.json(rule);
}
