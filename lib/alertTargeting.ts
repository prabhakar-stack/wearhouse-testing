import { prisma } from './prisma.ts';
import { Role, AlertLevel } from '@prisma/client';

/**
 * Resolves a target user ID from a list of target role, level, or email identifiers.
 * 1. Checks if identifiers are email addresses (contains '@')
 * 2. Checks if identifiers match an AlertLevel (L1, L2, L3, L4)
 * 3. Checks if identifiers match a direct Role (ADMIN, INSPECTOR, etc.)
 */
export async function resolveTargetUserId(targetRoles?: string[]): Promise<string | null> {
  if (!targetRoles || targetRoles.length === 0) return null;

  for (const target of targetRoles) {
    const cleanTarget = target.trim();
    const upperTarget = cleanTarget.toUpperCase();

    // 1. Check if it's an email (contains '@')
    if (cleanTarget.includes('@')) {
      const user = await (prisma as any).user.findFirst({
        where: { email: { equals: cleanTarget, mode: 'insensitive' } },
        select: { id: true }
      });
      if (user) return user.id;
    }

    // 2. Check if it's an AlertLevel (L1, L2, L3, L4)
    if (['L1', 'L2', 'L3', 'L4'].includes(upperTarget)) {
      const user = await (prisma as any).user.findFirst({
        where: { alertLevel: upperTarget as AlertLevel },
        select: { id: true }
      });
      if (user) return user.id;
    }

    // 3. Check if it's a direct role
    const validRoles = ['SUPER_ACCESS', 'ADMIN', 'RECEIVER', 'INSPECTOR', 'CLAIMS_SPECIALIST', 'RECOVERER', 'QC_AGENT'];
    if (validRoles.includes(upperTarget)) {
      const user = await (prisma as any).user.findFirst({
        where: { role: upperTarget as Role },
        select: { id: true }
      });
      if (user) return user.id;
    }
  }

  return null;
}
