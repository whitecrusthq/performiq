import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "stream";
import { S3Client } from "@aws-sdk/client-s3";
import { describeS3Error, s3TestConnection } from "./s3-storage.js";

const sdkError = (name: string, message: string, status?: number, extra: any = {}) =>
  Object.assign(new Error(message), { name, $metadata: status ? { httpStatusCode: status } : {}, ...extra });

const provider: any = { id: 1, type: "digitalocean_spaces", config: { bucket: "hr-files", accessKeyId: "a", secretAccessKey: "s", region: "nyc3" } };

test("the bodiless 'Unknown: UnknownError' becomes a cause based on its HTTP status", () => {
  assert.match(describeS3Error(sdkError("Unknown", "UnknownError", 403), "hr-files").message, /^Access denied \(HTTP 403\).*"hr-files"/);
  assert.match(describeS3Error(sdkError("Unknown", "UnknownError", 404)).message, /wasn't found \(HTTP 404\)/);
  assert.match(describeS3Error(sdkError("Unknown", "UnknownError", 301)).message, /different region/);
  assert.match(describeS3Error(sdkError("Unknown", "UnknownError", 400)).message, /region or endpoint is wrong/);
  assert.match(describeS3Error(sdkError("Unknown", "UnknownError", 503)).message, /internal error \(HTTP 503\)/);
});

test("named S3 errors and network failures get specific causes", () => {
  assert.match(describeS3Error(sdkError("InvalidAccessKeyId", "x", 403)).message, /access key isn't recognised/);
  assert.match(describeS3Error(sdkError("SignatureDoesNotMatch", "x", 403)).message, /secret key doesn't match/);
  assert.match(describeS3Error(sdkError("NoSuchBucket", "x", 404)).message, /wasn't found/);
  assert.match(describeS3Error(sdkError("PermanentRedirect", "x", 301)).message, /different region/);
  assert.match(describeS3Error(Object.assign(new Error("getaddrinfo"), { code: "ENOTFOUND" })).message, /Couldn't reach the storage provider \(ENOTFOUND\)/);
  assert.match(describeS3Error(sdkError("Weird", "odd thing", 418)).message, /Upload failed \(HTTP 418\): Weird: odd thing/);
});

test("connection test writes, reads back and deletes a test file", async () => {
  const original = S3Client.prototype.send;
  const ops: string[] = [];
  let stored: Buffer | null = null;
  try {
    (S3Client.prototype as any).send = async function (cmd: any) {
      const op = cmd.constructor.name;
      ops.push(`${op}:${cmd.input.Bucket}:${String(cmd.input.Key).split("/")[0]}`);
      if (op === "PutObjectCommand") { stored = cmd.input.Body; return {}; }
      if (op === "GetObjectCommand") return { Body: Readable.from([stored!]) };
      return {};
    };
    const r = await s3TestConnection(provider);
    assert.equal(r.ok, true, r.message);
    assert.deepEqual(ops, [
      "PutObjectCommand:hr-files:performiq-connection-test",
      "GetObjectCommand:hr-files:performiq-connection-test",
      "DeleteObjectCommand:hr-files:performiq-connection-test",
    ]);
  } finally {
    (S3Client.prototype as any).send = original;
  }
});

test("connection test reports the failing step in plain English", async () => {
  const original = S3Client.prototype.send;
  try {
    (S3Client.prototype as any).send = async () => { throw sdkError("Unknown", "UnknownError", 403); };
    const r = await s3TestConnection(provider);
    assert.equal(r.ok, false);
    assert.match(r.message, /Access denied \(HTTP 403\)/);

    (S3Client.prototype as any).send = async (cmd: any) => {
      if (cmd.constructor.name === "DeleteObjectCommand") throw sdkError("AccessDenied", "no delete", 403);
      if (cmd.constructor.name === "GetObjectCommand") return { Body: Readable.from([Buffer.alloc(0)]) };
      return {};
    };
    const mismatch = await s3TestConnection(provider);
    assert.equal(mismatch.ok, false);
    assert.match(mismatch.message, /came back different/);
  } finally {
    (S3Client.prototype as any).send = original;
  }
});
