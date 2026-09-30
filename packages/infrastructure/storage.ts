import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getConfig } from '../configuration/env.js';
function connection() { const env = getConfig(); return { bucket: env.S3_BUCKET, client: new S3Client({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION, forcePathStyle: true, credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } }) }; }
export async function preserveSource(key: string, body: Buffer) {
  const { client, bucket } = connection();
  const result = await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/octet-stream', IfNoneMatch: '*' }));
  return result.VersionId ?? null;
}
export async function readSource(key: string, version: string | null) {
  const { client, bucket } = connection();
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, ...(version ? { VersionId: version } : {}) }));
  if (!response.Body) throw new Error('Missing object body');
  return response.Body.transformToByteArray();
}
