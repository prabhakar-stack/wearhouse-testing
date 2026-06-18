import { prisma } from './prisma.ts';
import { Role, AlertLevel } from '@prisma/client';

const ALERT_LEVELS = new Set(['L1', 'L2', 'L3', 'L4']);

const ROLE_ALIASES: Record<string, Role> = {
  RECEIVER: 'RECEIVER',
  INSPECTOR: 'INSPECTOR',
  QC: 'QC_AGENT',
  QC_AGENT: 'QC_AGENT',
  RECOVERY: 'RECOVERER',
  RECOVERER: 'RECOVERER',
  ADMIN: 'ADMIN',
  SUPER_ACCESS: 'SUPER_ACCESS',
  'SUPER-ACCESS': 'SUPER_ACCESS',
  CLAIMS_SPECIALIST: 'CLAIMS_SPECIALIST',
  CLAIMS: 'CLAIMS_SPECIALIST',
};

/**
 * Resolves all target user IDs from a list of target role, level, or email identifiers.
 * Uses a single batched DB query instead of one query per target entry.
 */
export async function resolveTargetUserIds(targetRoles?: string[]): Promise<string[]> {
  if (!targetRoles || targetRoles.length === 0) return [];

  const emails: string[] = [];
  const levels: AlertLevel[] = [];
  const roles: Role[] = [];

  for (const target of targetRoles) {
    const clean = target.trim();
    const upper = clean.toUpperCase();

    if (clean.includes('@')) {
      emails.push(clean);
    } else if (ALERT_LEVELS.has(upper)) {
      levels.push(upper as AlertLevel);
    } else if (ROLE_ALIASES[upper]) {
      roles.push(ROLE_ALIASES[upper]);
    }
  }

  if (emails.length === 0 && levels.length === 0 && roles.length === 0) return [];

  const orConditions: any[] = [];
  if (emails.length > 0) orConditions.push({ email: { in: emails, mode: 'insensitive' } });
  if (levels.length > 0) orConditions.push({ alertLevel: { in: levels } });
  if (roles.length > 0)  orConditions.push({ role: { in: roles } });

  const users = await prisma.user.findMany({
    where: { OR: orConditions },
    select: { id: true },
  });

  return [...new Set(users.map(u => u.id))];
}
