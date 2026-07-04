import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { decryptMessage } from "@/lib/pgp";

const schema = z.object({
  armored: z.string().min(1),
  passphrase: z.string().optional(),
});

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const body = schema.parse(await request.json());
  const keys = await prisma.pgpKey.findMany({
    where: {
      userId: authResult.userId,
      privateKeyEnc: { not: null },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  if (keys.length === 0) {
    return jsonError("No private PGP key on file. Add one in Settings → Encryption.", 400);
  }

  let lastError: Error | null = null;
  for (const key of keys) {
    if (!key.privateKeyEnc) continue;
    try {
      const privateKey = decryptSecret(key.privateKeyEnc);
      const plaintext = await decryptMessage(body.armored, privateKey, body.passphrase);
      return NextResponse.json({ plaintext, keyEmail: key.email });
    } catch (e) {
      lastError = e instanceof Error ? e : new Error("Decrypt failed");
    }
  }

  return jsonError(
    lastError?.message?.includes("passphrase")
      ? "Passphrase required or incorrect"
      : lastError?.message || "Could not decrypt with any stored private key",
    400,
  );
}
