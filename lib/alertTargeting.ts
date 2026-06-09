import { prisma } from './prisma.ts';
import { Role, AlertLevel } from '@prisma/client';

/**
 * Resolves all target user IDs from a list of target role, level, or email identifiers.
 */
export async function resolveTargetUserIds(targetRoles?: string[]): Promise<string[]> {
  if (!targetRoles || targetRoles.length === 0) return [];

  const userIds: string[] = [];

  for (const target of targetRoles) {
    const cleanTarget = target.trim();
    const upperTarget = cleanTarget.toUpperCase();

    // 1. Check if it's an email (contains '@')
    if (cleanTarget.includes('@')) {
      const user = await (prisma as any).user.findFirst({
        where: { email: { equals: cleanTarget, mode: 'insensitive' } },
        select: { id: true }
      });
      if (user) userIds.push(user.id);
    }

    // 2. Check if it's an AlertLevel (L1, L2, L3, L4)
    if (['L1', 'L2', 'L3', 'L4'].includes(upperTarget)) {
      const users = await (prisma as any).user.findMany({
        where: { alertLevel: upperTarget as AlertLevel },
        select: { id: true }
      });
      userIds.push(...users.map((u: { id: string }) => u.id));
    }

    // 3. Check if it's a direct role
    let roleEnum: Role | null = null;
    if (upperTarget === 'RECEIVER') roleEnum = 'RECEIVER';
    else if (upperTarget === 'INSPECTOR') roleEnum = 'INSPECTOR';
    else if (upperTarget === 'QC' || upperTarget === 'QC_AGENT') roleEnum = 'QC_AGENT';
    else if (upperTarget === 'RECOVERY' || upperTarget === 'RECOVERER') roleEnum = 'RECOVERER';
    else if (upperTarget === 'ADMIN') roleEnum = 'ADMIN';
    else if (upperTarget === 'SUPER_ACCESS' || upperTarget === 'SUPER-ACCESS') roleEnum = 'SUPER_ACCESS';
    else if (upperTarget === 'CLAIMS_SPECIALIST' || upperTarget === 'CLAIMS') roleEnum = 'CLAIMS_SPECIALIST';

    if (roleEnum) {
      const users = await (prisma as any).user.findMany({
        where: { role: roleEnum },
        select: { id: true }
      });
      userIds.push(...users.map((u: { id: string }) => u.id));
    }
  }

  return [...new Set(userIds)];
}

