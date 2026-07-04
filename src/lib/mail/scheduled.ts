import { prisma } from "@/lib/db";
import { canAccessIdentity } from "@/lib/identities";
import { sendIdentityMail } from "@/lib/mail/service";

export async function processDueScheduledSends(userId: string) {
  const due = await prisma.scheduledSend.findMany({
    where: {
      userId,
      sent: false,
      sendAt: { lte: new Date() },
    },
    take: 20,
  });

  let sent = 0;
  for (const row of due) {
    const access = await canAccessIdentity(userId, row.identityId);
    if (!access) continue;
    try {
      await sendIdentityMail(access.identity, {
        to: row.to,
        cc: row.cc,
        bcc: row.bcc,
        subject: row.subject,
        html: row.htmlBody || undefined,
        text: row.textBody || undefined,
      });
      await prisma.scheduledSend.update({
        where: { id: row.id },
        data: { sent: true },
      });
      sent += 1;
    } catch {
      /* leave for retry */
    }
  }
  return sent;
}
