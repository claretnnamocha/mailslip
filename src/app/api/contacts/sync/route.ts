import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { listAccessibleIdentities, identityToConfig } from "@/lib/identities";
import { fetchCardDavContacts } from "@/lib/mail/carddav";

export async function POST() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const identities = await listAccessibleIdentities(authResult.userId);
  const withCardDav = identities.find((i) => i.cardDavUrl);
  if (!withCardDav?.cardDavUrl) {
    return jsonError("No identity has a CardDAV URL configured", 400);
  }

  if (process.env.DEMO_MAIL === "true") {
    const demo = [
      { name: "Folake Bello", email: "folake@studio.co" },
      { name: "Tunde Adeyemi", email: "tunde@example.com" },
    ];
    for (const c of demo) {
      const existing = await prisma.contact.findFirst({
        where: { userId: authResult.userId, email: c.email },
      });
      if (existing) {
        await prisma.contact.update({ where: { id: existing.id }, data: { name: c.name } });
      } else {
        await prisma.contact.create({ data: { userId: authResult.userId, ...c } });
      }
    }
    return NextResponse.json({ synced: demo.length });
  }

  const config = identityToConfig(withCardDav);
  if (!config) return jsonError("Credentials missing", 400);

  try {
    const contacts = await fetchCardDavContacts({
      url: withCardDav.cardDavUrl,
      username: config.username,
      password: config.password,
    });
    let synced = 0;
    for (const c of contacts) {
      const existing = await prisma.contact.findFirst({
        where: { userId: authResult.userId, email: c.email },
      });
      if (existing) {
        await prisma.contact.update({
          where: { id: existing.id },
          data: { name: c.name, phone: c.phone, company: c.company },
        });
      } else {
        await prisma.contact.create({
          data: {
            userId: authResult.userId,
            name: c.name,
            email: c.email,
            phone: c.phone,
            company: c.company,
          },
        });
      }
      synced += 1;
    }
    return NextResponse.json({ synced });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "CardDAV sync failed", 500);
  }
}
