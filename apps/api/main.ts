import { buildServer } from './server.js';
import { getConfig } from '../../packages/configuration/env.js';
import { pool } from '../../packages/infrastructure/db.js';
const app = buildServer(true);
const stop = async () => { await app.close(); await pool.end(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
await app.listen({ port: getConfig().API_PORT, host: '127.0.0.1' });
