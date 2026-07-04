import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const [blocked, allowed] = await Promise.all([
    prisma.blockedSender.findMany({ where: { userId: authResult.userId } }),
    prisma.allowedSender.findMany({ where: { userId: authResult.userId } }),
  ]);
  return NextResponse.json({ blocked, allowed });
}

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const body = await request.json();
  if (body.list === "allowed") {
    const row = await prisma.allowedSender.create({
      data: { userId: authResult.userId, value: body.value },
    });
    return NextResponse.json(row);
  }
  const row = await prisma.blockedSender.create({
    data: { userId: authResult.userId, value: body.value },
  });
  return NextResponse.json(row);
}
