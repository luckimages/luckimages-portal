import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 is S3-compatible, so the AWS SDK talks to it directly —
// only the endpoint differs from real S3. Two buckets, mirroring the old
// Supabase Storage split: MEDIA is private (originals, paid downloads only),
// PUBLIC is served with no auth (thumbnails + avatars, distinguished by path
// prefix so we don't need a third bucket).
export const R2_MEDIA_BUCKET = "luckimages-media";
export const R2_PUBLIC_BUCKET = "luckimages-thumbnails";

// The public bucket's Cloudflare "Public Development URL". Swap this for a
// custom domain (e.g. media.luckimages.com) later — nothing else in the app
// needs to change, since every caller goes through getPublicUrl() below.
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL || "";

let client: S3Client | null = null;
function r2Client(): S3Client {
  if (client) return client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
  }
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

export function r2Configured(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
}

export async function r2Upload(bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
  await r2Client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function r2Download(bucket: string, key: string): Promise<Buffer> {
  const res = await r2Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

// R2 has no bulk-delete size limit concern at our scale — one request for
// up to 1000 keys, matching Supabase Storage's .remove(paths[]) shape.
export async function r2Delete(bucket: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await r2Client().send(new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: { Objects: keys.map(Key => ({ Key })) },
  }));
}

export async function r2SignedUrl(bucket: string, key: string, expiresInSeconds: number): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return presign(r2Client(), cmd, { expiresIn: expiresInSeconds });
}

// A presigned PUT URL so the browser can upload originals straight to R2,
// bypassing Vercel's ~4.5MB serverless request-body limit the same way the
// old direct-to-Supabase upload did — the bytes never pass through our
// server at all, just this one small JSON pointer request does.
export async function r2SignedPutUrl(bucket: string, key: string, contentType: string, expiresInSeconds: number): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return presign(r2Client(), cmd, { expiresIn: expiresInSeconds });
}

// Public bucket only — stable URL, no token, so browsers can actually cache it.
export function r2PublicUrl(key: string): string {
  return `${R2_PUBLIC_BASE_URL}/${key}`;
}
