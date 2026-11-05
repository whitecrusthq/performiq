import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
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
    // Recent @aws-sdk/client-s3 (>=3.729) adds CRC32 integrity checksums to every
    // request by default. S3-compatible providers (DigitalOcean Spaces, R2, B2,
    // MinIO) reject these headers, and the checksum can't be computed over a
    // streamed (non-rewindable) request body — which caused proxy uploads to fail
    // with a 500. Only compute/validate checksums when the operation requires it.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
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

export async function s3DeleteObject(provider: DecryptedS3Provider, key: string): Promise<void> {
  await buildClient(provider).send(new DeleteObjectCommand({ Bucket: provider.config.bucket, Key: fullKey(provider, key) }));
}

/**
 * Turns an AWS SDK / S3-compatible error into a plain-English cause. Providers
 * sometimes return errors with no body, which the SDK reports only as
 * "Unknown: UnknownError"; the HTTP status is then the only clue.
 */
export function describeS3Error(err: any, bucket?: string): { status?: number; message: string } {
  const status: number | undefined = err?.$metadata?.httpStatusCode;
  const code = String(err?.Code || err?.code || err?.name || "");
  const net = String(err?.code || err?.cause?.code || "");
  const where = bucket ? ` "${bucket}"` : "";
  const fix = " Check it under Settings → Storage Providers.";
  const tag = status ? ` (HTTP ${status})` : "";

  if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ETIMEDOUT", "ECONNRESET"].includes(net)) {
    return { status, message: `Couldn't reach the storage provider (${net}). The endpoint or region may be wrong.${fix}` };
  }
  if (code === "InvalidAccessKeyId") {
    return { status, message: `The storage access key isn't recognised${tag}. It may have been deleted or mistyped.${fix}` };
  }
  if (code === "SignatureDoesNotMatch") {
    return { status, message: `The storage secret key doesn't match the access key${tag}.${fix}` };
  }
  if (code === "NoSuchBucket" || status === 404) {
    return { status, message: `The bucket${where} wasn't found${tag}. Check the bucket name and region.${fix}` };
  }
  if (["PermanentRedirect", "AuthorizationHeaderMalformed", "IllegalLocationConstraintException"].includes(code) || status === 301) {
    return { status, message: `The bucket${where} is in a different region from the one configured${tag}.${fix}` };
  }
  if (code === "AccessDenied" || code === "Forbidden" || status === 403) {
    return { status, message: `Access denied${tag}: the access key can't write to the bucket${where}. Check the access key, secret and the key's bucket permissions.${fix}` };
  }
  if (status === 400) {
    return { status, message: `The storage provider rejected the request${tag}. This usually means the region or endpoint is wrong.${fix}` };
  }
  if (status === 411 || status === 501) {
    return { status, message: `The storage provider refused this type of upload${tag}. Check the endpoint is the provider's S3-compatible API.${fix}` };
  }
  if (status && status >= 500) {
    return { status, message: `The storage provider had an internal error${tag}. Try again shortly.` };
  }
  const raw = [err?.name, err?.Code || err?.code, err?.message].filter(Boolean).join(": ");
  return { status, message: `Upload failed${tag}: ${raw || "unknown error"}.${fix}` };
}

/** Writes, reads back and deletes a tiny object to prove the configuration works end to end. */
export async function s3TestConnection(provider: DecryptedS3Provider): Promise<{ ok: boolean; message: string }> {
  const key = `performiq-connection-test/${randomUUID()}.txt`;
  const body = Buffer.from(`PerformIQ storage test ${new Date().toISOString()}`);
  let step = "upload";
  try {
    await s3PutObject(provider, key, body, "text/plain", body.length);
    step = "read back";
    const obj = await s3GetObject(provider, key);
    const chunks: Buffer[] = [];
    for await (const c of obj.stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    if (!Buffer.concat(chunks).equals(body)) {
      return { ok: false, message: "The test file was uploaded but came back different. Check the bucket isn't behind a transforming proxy." };
    }
    step = "delete";
    await s3DeleteObject(provider, key);
    return { ok: true, message: `Connected. A test file was uploaded to "${provider.config.bucket}", read back and deleted.` };
  } catch (err: any) {
    const { message } = describeS3Error(err, provider.config.bucket);
    const stage = step === "upload" ? "" : step === "read back" ? " Uploading worked, but reading the file back failed." : " Upload and read worked, but deleting the test file failed (uploads will still work).";
    return { ok: step === "delete", message: `${message}${stage}` };
  }
}
