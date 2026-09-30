import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
const pool = new pg.Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
try {
  await migrate(drizzle(pool), { migrationsFolder: './database/migrations' });
  const password = process.env.APP_DATABASE_PASSWORD;
  if (!password || !/^[a-f0-9]{48}$/.test(password)) throw new Error('Run pnpm setup to generate the local application password.');
  // Identifier is a fixed infrastructure role; password is validated hex, not user input.
  if (!(await pool.query("SELECT 1 FROM pg_roles WHERE rolname='moblux_app'")).rowCount) await pool.query(`CREATE ROLE moblux_app LOGIN PASSWORD '${password}'`);
  await pool.query('GRANT USAGE ON SCHEMA public TO moblux_app; GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO moblux_app; GRANT DELETE ON sessions TO moblux_app;');
  await pool.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO moblux_app;');
  console.log('Migrations applied. Runtime role has no UPDATE/DELETE on immutable records.');
} finally { await pool.end(); }
