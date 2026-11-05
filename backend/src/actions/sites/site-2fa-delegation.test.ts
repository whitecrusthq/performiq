import test from "node:test";
import assert from "node:assert/strict";
import SiteController from "../../controllers/SiteController.js";
import { CreateSiteAction } from "./CreateSiteAction.js";
import { UpdateSiteAction } from "./UpdateSiteAction.js";
import { BulkImportSitesAction } from "./BulkImportSitesAction.js";
import { DeleteSiteAction } from "./DeleteSiteAction.js";

/** Runs an action with SiteController stubbed, returning the status and the stub's calls. */
async function run(action: any, req: any, existing2Fa = false) {
  const names = ["create", "update", "bulkImport", "delete", "find"] as const;
  const originals = Object.fromEntries(names.map((n) => [n, (SiteController as any)[n]]));
  const calls: Record<string, any[]> = {};
  for (const n of names) {
    (SiteController as any)[n] = async (...args: any[]) => {
      calls[n] = args;
      return n === "find" ? { id: 1, require2Fa: existing2Fa } : { id: 1 };
    };
  }
  let status = 200;
  const res: any = { status(c: number) { status = c; return this; }, json() { return this; } };
  try {
    await action.handle({ params: { id: "1" }, body: {}, ...req }, res);
  } finally {
    for (const n of names) (SiteController as any)[n] = originals[n];
  }
  return { status, calls };
}

const body = { name: "Lagos", require2Fa: false };

test("site 2FA: delegated create and update ignore require2Fa", async () => {
  assert.equal((await run(CreateSiteAction, { body: { ...body, require2Fa: true } })).calls.create[0].require2Fa, undefined);
  assert.equal((await run(UpdateSiteAction, { body })).calls.update[1].require2Fa, undefined);
});

test("site 2FA: admins can set require2Fa", async () => {
  assert.equal((await run(CreateSiteAction, { isFullAdmin: true, body: { ...body, require2Fa: true } })).calls.create[0].require2Fa, true);
  assert.equal((await run(UpdateSiteAction, { isFullAdmin: true, body })).calls.update[1].require2Fa, false);
});

test("site 2FA: delegated bulk import drops both spellings of the column", async () => {
  const sites = [{ name: "A", require2Fa: "true", require2fa: "true", city: "Abuja" }];
  assert.deepEqual((await run(BulkImportSitesAction, { body: { sites } })).calls.bulkImport[0], [{ name: "A", city: "Abuja" }]);
  assert.deepEqual((await run(BulkImportSitesAction, { isFullAdmin: true, body: { sites } })).calls.bulkImport[0], sites);
});

test("site 2FA: delegated users cannot delete a site that requires 2FA", async () => {
  const refused = await run(DeleteSiteAction, {}, true);
  assert.equal(refused.status, 403);
  assert.equal(refused.calls.delete, undefined);
  assert.deepEqual((await run(DeleteSiteAction, {}, false)).calls.delete, [1]);
  assert.deepEqual((await run(DeleteSiteAction, { isFullAdmin: true }, true)).calls.delete, [1]);
});
