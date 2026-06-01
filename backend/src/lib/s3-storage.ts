import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "stream";

/**
 * S3-compatible storage helper used when an admin has configured (and set as
 * default) an AWS S3, S3-compatible (R2/B2/MinIO), or DigitalOcean Spaces
 * provider on the Storage Providers settings page. Credentials are passed in
 * already-decrypted by StorageProviderController.
 */

export type S3ProviderType = "s3" | "s3_compatible" | "digitalocean_spaces";

export interface DecryptedS3Provider {
  id: number;
  type: S3ProviderType;
  config: {
    region?: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
    forcePathStyle?: boolean;
    prefix?: string;
  };
}

function resolveEndpoint(provider: DecryptedS3Provider): string | undefined {
  const { type, config } = provider;
  if (type === "digitalocean_spaces") {
    const region = (config.region || "nyc3").trim();
    return `https://${region}.digitaloceanspaces.com`;
  }
  if (type === "s3_compatible") {
    return config.endpoint?.trim() || undefined;
  }
  return undefined; // native AWS S3 derives endpoint from region
}

function buildClient(provider: DecryptedS3Provider): S3Client {
  const { type, config } = provider;
  return new S3Client({
    region: (config.region || "us-east-1").trim(),
    endpoint: resolveEndpoint(provider),
    forcePathStyle: type === "s3_compatible" ? !!config.forcePathStyle : false,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function fullKey(provider: DecryptedS3Provider, key: string): string {
  let prefix = (provider.config.prefix || "").trim();
  if (prefix.startsWith("/")) prefix = prefix.slice(1);
  if (prefix && !prefix.endsWith("/")) prefix += "/";
  const k = key.startsWith("/") ? key.slice(1) : key;
  return `${prefix}${k}`;
}

export async function s3PutObject(
  provider: DecryptedS3Provider,
  key: string,
  body: Buffer | Readable,
  contentType: string,
  contentLength?: number,
): Promise<void> {
  const client = buildClient(provider);
  const len = contentLength ?? (Buffer.isBuffer(body) ? body.length : undefined);
  await client.send(
    new PutObjectCommand({
      Bucket: provider.config.bucket,
      Key: fullKey(provider, key),
      Body: body,
      ContentType: contentType,
      ContentLength: len,
    }),
  );
}

export async function s3GetObject(
  provider: DecryptedS3Provider,
  key: string,
): Promise<{ stream: Readable; contentType?: string; contentLength?: number }> {
  const client = buildClient(provider);
  const out = await client.send(
    new GetObjectCommand({
      Bucket: provider.config.bucket,
      Key: fullKey(provider, key),
    }),
  );
  return {
    stream: out.Body as Readable,
    contentType: out.ContentType,
    contentLength: typeof out.ContentLength === "number" ? out.ContentLength : undefined,
  };
}
