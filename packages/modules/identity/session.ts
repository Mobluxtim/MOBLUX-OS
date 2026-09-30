import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../../infrastructure/db.js';
import { sessions, users, roleGrants, userRoles, userOverrides, audit } from '../../../database/schema.js';
import { getConfig } from '../../configuration/env.js';
import { DomainError, type Actor } from './policy.js';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function login(code: string) {
  const config = getConfig();
  if (!timingSafeEqual(Buffer.from(hash(code)), Buffer.from(hash(config.DEV_LOGIN_CODE)))) throw new DomainError(401, 'The development login code is incorrect.');
  const user = await db.query.users.findFirst({ where: and(eq(users.email, config.DEV_ADMIN_EMAIL), eq(users.active, true), eq(users.kind, 'staff')) });
  if (!user) throw new DomainError(401, 'Development account unavailable. Run the seed command.');
  const token = randomBytes(32).toString('hex');
  await db.transaction(async tx => { await tx.insert(sessions).values({ tokenHash: hash(token), userId: user.id, expiresAt: new Date(Date.now() + 8 * 3600000) }); await tx.insert(audit).values({ actorId: user.id, entityId: user.id, event: 'session.created', details: { authentication: 'local-development' } }); });
  return token;
}
export async function authenticate(token: string | undefined): Promise<Actor & { name: string; email: string }> {
  if (!token) throw new DomainError(401, 'Please sign in.');
  const [row] = await db.select({ user: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(and(eq(sessions.tokenHash, hash(token)), gt(sessions.expiresAt, new Date()), eq(users.active, true)));
  if (!row) throw new DomainError(401, 'Your session has expired. Please sign in again.');
  const grants = await db.select({ capability: roleGrants.capability }).from(userRoles).innerJoin(roleGrants, eq(roleGrants.roleId, userRoles.roleId)).where(eq(userRoles.userId, row.user.id));
  const overrides = await db.select().from(userOverrides).where(eq(userOverrides.userId, row.user.id));
  return { ...row.user, grants: new Set([...grants.map(g => g.capability), ...overrides.filter(o => o.allowed).map(o => o.capability)]), denies: new Set(overrides.filter(o => !o.allowed).map(o => o.capability)) };
}
export async function logout(token: string) { await db.delete(sessions).where(eq(sessions.tokenHash, hash(token))); }
