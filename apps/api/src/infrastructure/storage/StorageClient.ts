import { env } from "../../config/env.js";

/**
 * StorageClient — thin wrapper for S3-compatible file uploads.
 *
 * Configured for Cloudflare R2 (or any S3-compatible endpoint via STORAGE_ENDPOINT).
 * Falls back gracefully (throws 503-like error) when env vars are not set.
 *
 * Reads: STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY,
 *        STORAGE_PUBLIC_URL, STORAGE_REGION
 *
 * Exposed functions:
 *   uploadFile(key, buffer, contentType) → Promise<string>  — returns public URL
 *   getSignedDownloadUrl(key)            → Promise<string>  — signed URL (5min TTL)
 *
 * Plan 11-02 T2.
 */

export class StorageNotConfiguredError extends Error {
  readonly code = "STORAGE_NOT_CONFIGURED";
  constructor() {
    super("Storage is not configured. Set STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY.");
  }
}

function assertConfigured(): void {
  if (
    !env.STORAGE_ENDPOINT ||
    !env.STORAGE_BUCKET ||
    !env.STORAGE_ACCESS_KEY ||
    !env.STORAGE_SECRET_KEY
  ) {
    throw new StorageNotConfiguredError();
  }
}

/**
 * Upload a file to S3-compatible storage.
 *
 * @param key         - Object key (path within bucket), e.g. "kyc/vendor-id/id_proof.pdf"
 * @param buffer      - File content as a Buffer
 * @param contentType - MIME type, e.g. "application/pdf", "image/jpeg"
 * @returns           Public URL of the uploaded file
 * @throws            StorageNotConfiguredError if env vars not set
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  assertConfigured();

  // Dynamic import to avoid hard-dep on @aws-sdk/client-s3 at module load time.
  // The SDK must be installed in apps/api/package.json for uploads to work.
  // If not installed, this will throw a module-not-found error at call time.
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const client = new S3Client({
    endpoint: env.STORAGE_ENDPOINT!,
    region: env.STORAGE_REGION,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY!,
      secretAccessKey: env.STORAGE_SECRET_KEY!,
    },
    // Required for Cloudflare R2: force path-style addressing
    forcePathStyle: true,
  });

  await client.send(
    new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  // Return public URL (CDN URL if STORAGE_PUBLIC_URL is set, otherwise construct from endpoint)
  const publicBase = env.STORAGE_PUBLIC_URL ?? `${env.STORAGE_ENDPOINT}/${env.STORAGE_BUCKET}`;
  return `${publicBase}/${key}`;
}

/**
 * Generate a signed download URL for a private file (5-minute TTL).
 *
 * @param key - Object key in the bucket
 * @returns   Signed URL valid for 300 seconds
 * @throws    StorageNotConfiguredError if env vars not set
 */
export async function getSignedDownloadUrl(key: string): Promise<string> {
  assertConfigured();

  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const client = new S3Client({
    endpoint: env.STORAGE_ENDPOINT!,
    region: env.STORAGE_REGION,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY!,
      secretAccessKey: env.STORAGE_SECRET_KEY!,
    },
    forcePathStyle: true,
  });

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: env.STORAGE_BUCKET!,
      Key: key,
    }),
    { expiresIn: 300 } // 5-minute TTL
  );
}

/**
 * StorageClient object — registered as Awilix value in container.ts.
 * Use this in services that need file upload/download functionality.
 */
export const storageClient = {
  uploadFile,
  getSignedDownloadUrl,
};

export type StorageClientType = typeof storageClient;
