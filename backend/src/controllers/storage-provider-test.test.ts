import test from "node:test";
import assert from "node:assert/strict";
import StorageProviderController from "./StorageProviderController.js";
import StorageProvider from "../models/StorageProvider.js";

test("connection test handles unknown, non-S3 and incomplete providers without calling storage", async () => {
  const original = StorageProvider.findByPk;
  try {
    (StorageProvider.findByPk as any) = async () => null;
    assert.equal(((await StorageProviderController.testConnection(1)) as any).status, 404);

    (StorageProvider.findByPk as any) = async () => ({ id: 2, type: "azure", config: {} });
    const azure: any = await StorageProviderController.testConnection(2);
    assert.equal(azure.data.ok, false);
    assert.match(azure.data.message, /only available for AWS S3/);

    (StorageProvider.findByPk as any) = async () => ({ id: 3, type: "digitalocean_spaces", config: { bucket: "b" } });
    const incomplete: any = await StorageProviderController.testConnection(3);
    assert.equal(incomplete.data.ok, false);
    assert.match(incomplete.data.message, /missing/);
  } finally {
    (StorageProvider.findByPk as any) = original;
  }
});

test("upload proxy errors are returned in plain English", async () => {
  process.env.JWT_SECRET ||= "storage-test-secret";
  const { ProxyUploadAction } = await import("../actions/storage/ProxyUploadAction.js");
  const { default: StorageController } = await import("./StorageController.js");
  const original = (StorageController as any).proxyUpload;
  const origError = console.error;
  try {
    console.error = () => {};
    (StorageController as any).proxyUpload = async () => {
      throw Object.assign(new Error("UnknownError"), { name: "Unknown", $metadata: { httpStatusCode: 403 } });
    };
    let status = 0; let body: any = null;
    const res: any = { headersSent: false, status(c: number) { status = c; return this; }, json(b: any) { body = b; return this; } };
    await ProxyUploadAction.handle({ params: { token: "t" } } as any, res);
    assert.equal(status, 500);
    assert.match(body.error, /^Access denied \(HTTP 403\)/);
    assert.equal(body.detail.httpStatus, 403);
  } finally {
    (StorageController as any).proxyUpload = original;
    console.error = origError;
  }
});

test("every storage provider route is behind the database-backed admin check", async () => {
  const { default: router } = await import("../routes/storage-providers.js");
  const { requireCurrentAdmin } = await import("../middlewares/auth.js");
  const layers = (router as any).stack.filter((l: any) => l.route);
  assert.ok(layers.some((l: any) => l.route.path === "/storage-providers/:id/test"));
  for (const l of layers) {
    assert.ok(l.route.stack.some((s: any) => s.handle === requireCurrentAdmin), `${Object.keys(l.route.methods)} ${l.route.path}`);
  }
});
