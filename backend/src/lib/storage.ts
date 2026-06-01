import { Storage } from "@google-cloud/storage";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import StorageProviderController from "../controllers/StorageProviderController.js";
import { s3PutObject, s3GetObject } from "./s3-storage.js";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set. Server cannot start without it.");
}

const UPLOAD_TOKEN_PURPOSE = "storage-upload";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

interface UploadTokenPayload {
  purpose: string;
  objectId: string;
  providerId: number;
}

export const storageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
} as any);

function parseObjectPath(path: string) {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  if (parts.length < 3) throw new Error("Invalid path");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

async function signObjectURL(opts: { bucketName: string; objectName: string; method: string; ttlSec: number }) {
  const request = {
    bucket_name: opts.bucketName,
    object_name: opts.objectName,
    method: opts.method,
    expires_at: new Date(Date.now() + opts.ttlSec * 1000).toISOString(),
  };
  const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Failed to sign URL: ${response.status}`);
  const { signed_url } = await response.json() as { signed_url: string };
  return signed_url;
}

export async function getUploadURL(): Promise<{ uploadURL: string; objectPath: string }> {
  // If an admin has configured a default S3-family provider (e.g. DigitalOcean
  // Spaces) we route uploads through our own backend proxy so the browser never
  // needs CORS configured on the bucket. Otherwise fall back to Replit storage.
  const provider = await StorageProviderController.getActiveUploadProvider();
  if (provider) {
    const objectId = randomUUID();
    const token = jwt.sign(
      { purpose: UPLOAD_TOKEN_PURPOSE, objectId, providerId: provider.id },
      JWT_SECRET as string,
      { expiresIn: "15m" },
    );
    return { uploadURL: `/api/storage/proxy-upload/${token}`, objectPath: `/objects/uploads/${objectId}` };
  }

  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR not set");
  const objectId = randomUUID();
  const fullPath = `${dir}/uploads/${objectId}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const uploadURL = await signObjectURL({ bucketName, objectName, method: "PUT", ttlSec: 900 });
  return { uploadURL, objectPath: `/objects/uploads/${objectId}` };
}

/** Handles the browser PUT for S3-family uploads and streams bytes to the bucket. */
export async function proxyUpload(token: string, req: Request, res: Response): Promise<void> {
  let payload: UploadTokenPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET as string) as UploadTokenPayload;
  } catch {
    res.status(401).json({ error: "Upload link expired or invalid" });
    return;
  }
  if (payload.purpose !== UPLOAD_TOKEN_PURPOSE || !payload.objectId || !payload.providerId) {
    res.status(401).json({ error: "Invalid upload token" });
    return;
  }

  // Require a declared size and enforce the cap BEFORE reading any bytes, so a
  // malicious client can't stream an unbounded body through the backend.
  const lenHeader = req.headers["content-length"];
  const contentLength = lenHeader ? parseInt(String(lenHeader), 10) : NaN;
  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    res.status(411).json({ error: "Content-Length header is required" });
    return;
  }
  if (contentLength > MAX_UPLOAD_BYTES) {
    res.status(413).json({ error: "File exceeds 50 MB limit" });
    return;
  }

  const provider = await StorageProviderController.getDecryptedUploadProviderById(payload.providerId);
  if (!provider) {
    res.status(400).json({ error: "Storage provider is unavailable or disabled" });
    return;
  }

  // Hard stop if the actual stream exceeds the declared length (defends against a
  // lying Content-Length), without ever buffering the whole file in memory.
  let received = 0;
  req.on("data", (c: Buffer) => {
    received += c.length;
    if (received > contentLength) req.destroy(new Error("Upload exceeded declared size"));
  });

  const contentType = (req.headers["content-type"] as string) || "application/octet-stream";
  await s3PutObject(provider, `uploads/${payload.objectId}`, req, contentType, contentLength);
  res.json({ ok: true });
}

async function serveFromReplit(entityId: string, res: any): Promise<void> {
  let dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) { res.status(404).json({ error: "Not found" }); return; }
  if (!dir.endsWith("/")) dir += "/";
  const fullPath = `${dir}${entityId}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const bucket = storageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  const [exists] = await file.exists();
  if (!exists) { res.status(404).json({ error: "Not found" }); return; }
  const [metadata] = await file.getMetadata();
  res.setHeader("Content-Type", (metadata.contentType as string) || "application/octet-stream");
  res.setHeader("Cache-Control", "private, max-age=3600");
  if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
  const stream = file.createReadStream();
  stream.pipe(res);
}

export async function serveObject(objectPath: string, res: any) {
  if (!objectPath.startsWith("/objects/")) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const entityId = objectPath.slice("/objects/".length); // e.g. "uploads/<id>"

  const provider = await StorageProviderController.getActiveUploadProvider();
  if (provider) {
    try {
      const obj = await s3GetObject(provider, entityId);
      res.setHeader("Content-Type", obj.contentType || "application/octet-stream");
      res.setHeader("Cache-Control", "private, max-age=3600");
      if (obj.contentLength) res.setHeader("Content-Length", String(obj.contentLength));
      obj.stream.pipe(res);
      return;
    } catch {
      // Object may predate the switch to this provider — fall back to Replit.
      await serveFromReplit(entityId, res);
      return;
    }
  }

  await serveFromReplit(entityId, res);
}
