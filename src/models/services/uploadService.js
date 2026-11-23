import crypto from 'node:crypto';
import { AppError } from '../errors';

const CONTENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function configuration() {
  const region = process.env.AWS_REGION;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !bucket || !accessKeyId || !secretAccessKey) return null;
  // S3-compatible providers (e.g. Neon Storage) need a custom endpoint and
  // path-style object URLs: https://endpoint/bucket/key.
  const endpoint = process.env.AWS_ENDPOINT_URL_S3?.replace(/\/$/, '') || null;
  const defaultBase = endpoint
    ? `${endpoint}/${bucket}`
    : `https://${bucket}.s3.${region}.amazonaws.com`;
  const publicBase = (process.env.S3_PUBLIC_BASE_URL || defaultBase).replace(/\/$/, '');
  return { region, bucket, accessKeyId, secretAccessKey, endpoint, publicBase };
}

export function uploadMode() {
  return configuration() ? 's3' : 'inline';
}

// Admins upload images straight to S3 with a short-lived presigned PUT when
// the bucket is configured. Otherwise the client sends a compressed data URL
// with the product, which works locally and on a fresh Neon deployment.
export async function presignProductImage(input) {
  const config = configuration();
  if (!config) return { mode: 'inline', maxBytes: MAX_UPLOAD_BYTES };

  const contentType = String(input?.contentType || '').toLowerCase();
  const extension = CONTENT_TYPES[contentType];
  if (!extension) throw new AppError('Use a JPEG, PNG or WebP image.');
  const size = Number(input?.size);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
    throw new AppError('Images must be under 8 MB.');
  }

  const key = `products/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const [{ PutObjectCommand, S3Client }, { getSignedUrl }] = await Promise.all([
    import('@aws-sdk/client-s3'),
    import('@aws-sdk/s3-request-presigner')
  ]);
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: Boolean(config.endpoint),
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  });
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType
  });
  const url = await getSignedUrl(client, command, { expiresIn: 300 });
  return {
    mode: 's3',
    method: 'PUT',
    url,
    key,
    headers: { 'Content-Type': contentType },
    publicUrl: `${config.publicBase}/${key}`,
    expiresIn: 300
  };
}
