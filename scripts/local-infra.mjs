import { existsSync, mkdirSync, openSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
const executable = resolve('.local/bin/rustfs.exe');
if (!existsSync(executable)) throw new Error('Run node scripts/download-storage.mjs first, or use pnpm infra:docker.');
if (process.env.DEV_AUTH_ENABLED !== 'true') throw new Error('This helper is only for local development.');
mkdirSync('.local/objects', { recursive: true });
const cluster = new EmbeddedPostgres({ databaseDir: resolve('.local/postgres'), user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, authMethod: 'scram-sha-256', port: 54329, persistent: true, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
if (!existsSync('.local/postgres/PG_VERSION')) await cluster.initialise();
await cluster.start();
const client = cluster.getPgClient('postgres', '127.0.0.1'); await client.connect();
if (!(await client.query("SELECT 1 FROM pg_database WHERE datname='moblux'")).rowCount) await cluster.createDatabase('moblux');
await client.end();
const log = openSync('.local/storage.log', 'a');
const storage = spawn(executable, ['server', '--address', '127.0.0.1:9000', resolve('.local/objects')], { env: { ...process.env, RUSTFS_CONSOLE_ENABLE: 'false', RUSTFS_ACCESS_KEY: process.env.S3_ACCESS_KEY, RUSTFS_SECRET_KEY: process.env.S3_SECRET_KEY }, stdio: ['ignore', log, log], windowsHide: true });
let stopping = false;
async function stop(code = 0) {
  if (stopping) return; stopping = true;
  storage.kill('SIGTERM');
  // pg_ctl performs a clean fast shutdown, unlike force-killing the Windows process tree.
  const postgresPath = cluster.process?.spawnfile;
  if (postgresPath) await new Promise(resolveExit => { const child = spawn(join(dirname(postgresPath), process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'), ['-D', resolve('.local/postgres'), 'stop', '-m', 'fast', '-w'], { windowsHide: true, stdio: 'ignore' }); child.on('exit', resolveExit); });
  cluster.process = undefined;
  process.exit(code);
}
storage.on('error', () => { console.error('Storage could not start. Check .local/storage.log.'); void stop(1); });
storage.on('exit', () => { if (!stopping) void stop(1); });
process.on('SIGINT', () => void stop()); process.on('SIGTERM', () => void stop());
console.log('PostgreSQL on 127.0.0.1:54329; storage starting on 127.0.0.1:9000. Keep this terminal open. Ctrl+C stops services and preserves data.');

