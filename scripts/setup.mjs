import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env')) { console.log('.env already exists; left unchanged.'); process.exit(0); }
const secret = () => randomBytes(24).toString('hex');
const owner = secret(), app = secret();
writeFileSync('.env', `DATABASE_URL=postgresql://moblux_app:${app}@127.0.0.1:54329/moblux
MIGRATION_DATABASE_URL=postgresql://moblux_owner:${owner}@127.0.0.1:54329/moblux
POSTGRES_USER=moblux_owner
POSTGRES_PASSWORD=${owner}
POSTGRES_DB=moblux
APP_DATABASE_PASSWORD=${app}
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_BUCKET=moblux-local
S3_ACCESS_KEY=${secret()}
S3_SECRET_KEY=${secret()}
DEV_AUTH_ENABLED=true
DEV_ADMIN_EMAIL=admin@moblux.local
DEV_LOGIN_CODE=${secret()}
APP_ORIGIN=http://localhost:3000
API_PORT=3001
`, { mode: 0o600 });
console.log('Created private .env. Your development login code is DEV_LOGIN_CODE in that file.');
