import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { S3Client, HeadBucketCommand, CreateBucketCommand, PutBucketVersioningCommand } from '@aws-sdk/client-s3';
import { users, roles, userRoles, roleGrants } from '../database/schema.js';
import { capabilities } from '../packages/modules/identity/policy.js';
import { getConfig } from '../packages/configuration/env.js';
const env = getConfig(); const pool = new pg.Pool({ connectionString: process.env.MIGRATION_DATABASE_URL }); const db = drizzle(pool);
try {
  await db.transaction(async tx => {
    await tx.insert(users).values({ email: env.DEV_ADMIN_EMAIL, name: 'Development administrator', kind: 'staff' }).onConflictDoNothing();
    await tx.insert(roles).values({ name: 'Development administrator' }).onConflictDoNothing();
    const [user] = await tx.select().from(users).where(eq(users.email, env.DEV_ADMIN_EMAIL));
    const [role] = await tx.select().from(roles).where(eq(roles.name, 'Development administrator'));
    await tx.insert(userRoles).values({ userId: user.id, roleId: role.id }).onConflictDoNothing();
    await tx.insert(roleGrants).values(capabilities.map(capability => ({ roleId: role.id, capability }))).onConflictDoNothing();
  });
  const client = new S3Client({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION, forcePathStyle: true, credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } });
  try { await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET })); } catch (error) { if ((error as { $metadata?: { httpStatusCode: number } }).$metadata?.httpStatusCode !== 404) throw error; await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET })); }
  await client.send(new PutBucketVersioningCommand({ Bucket: env.S3_BUCKET, VersioningConfiguration: { Status: 'Enabled' } }));
  console.log('Development administrator and private versioned bucket ready. No demo customers or projects inserted.');
} finally { await pool.end(); }
