import { z } from 'zod';
const configuration = z.object({
  DATABASE_URL: z.string().url(), APP_ORIGIN: z.string().url(), API_PORT: z.coerce.number().default(3001),
  S3_ENDPOINT: z.string().url(), S3_REGION: z.string().default('us-east-1'), S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(8), S3_SECRET_KEY: z.string().min(16),
  DEV_AUTH_ENABLED: z.literal('true'), DEV_ADMIN_EMAIL: z.string().email(), DEV_LOGIN_CODE: z.string().min(32)
});
export function getConfig() {
  const config = configuration.parse(process.env);
  if (!['localhost', '127.0.0.1'].includes(new URL(config.APP_ORIGIN).hostname)) throw new Error('Development authentication requires a loopback APP_ORIGIN.');
  return config;
}
