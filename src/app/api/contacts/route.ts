import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  return NextResponse.json(await prisma.contact.findMany({
    where: { userId: authResult.userId },
    orderBy: { name: "asc" },
  }));
}

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const body = await request.json();
  const contact = await prisma.contact.create({
    data: {
      userId: authResult.userId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      company: body.company,
      groups: body.groups || [],
    },
  });
  return NextResponse.json(contact);
}
