import { prisma } from "@/lib/db";

/** True when every workspace membership for this person is turned off. */
export async function accountIsDisabled(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { disabled: true },
  });
  return memberships.length > 0 && memberships.every((membership) => membership.disabled);
}
