import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { apiFetch } from "@/lib/utils";
import {
  HardDrive, Plus, Trash2, Edit2, Star, Power, PowerOff, X, Eye, EyeOff,
  AlertCircle, CheckCircle2,
} from "lucide-react";

type ProviderTypeKey = "s3" | "s3_compatible" | "digitalocean_spaces" | "gcs" | "azure";

interface TypeMeta {
  key: ProviderTypeKey;
  label: string;
  fields: string[];
  required: string[];
  secretFields: string[];
}

interface ProviderRow {
  id: number;
  name: string;
  type: ProviderTypeKey;
  typeLabel: string;
  isDefault: boolean;
  isEnabled: boolean;
  config: Record<string, any>;
  hasSecret: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

const FIELD_LABELS: Record<string, string> = {
  region: "Region",
  bucket: "Bucket name",
  container: "Container name",
  endpoint: "Endpoint URL",
  accessKeyId: "Access key ID",
  secretAccessKey: "Secret access key",
  prefix: "Path prefix (optional)",
  projectId: "GCP project ID",
  serviceAccountJson: "Service account JSON",
  accountName: "Storage account name",
  accountKey: "Account key",
  forcePathStyle: "Use path-style URLs",
};

const FIELD_PLACEHOLDERS: Record<string, string> = {
  region: "e.g. us-east-1, nyc3, eu-west-2",
  bucket: "my-bucket",
  container: "my-container",
  endpoint: "https://<account>.r2.cloudflarestorage.com",
  accessKeyId: "AKIA…",
  secretAccessKey: "Paste secret",
  prefix: "uploads/handbook (optional)",
  projectId: "my-gcp-project-123",
  serviceAccountJson: '{"type":"service_account", … }',
  accountName: "mystorageacct",
  accountKey: "Paste account key",
};

const DO_SPACES_REGIONS = [
  "nyc3", "sfo2", "sfo3", "ams3", "sgp1", "fra1", "blr1", "syd1", "lon1", "tor1",
];

export default function StorageProviders() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [types, setTypes] = useState<TypeMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProviderRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true); setError(null);
    try {
      const r = await apiFetch("/api/storage-providers");
      if (!r.ok) { setError("Could not load storage providers"); return; }
      const d = await r.json();
      setRows(d.rows ?? []);
      setTypes(d.types ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function remove(row: ProviderRow) {
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    const r = await apiFetch(`/api/storage-providers/${row.id}`, { method: "DELETE" });
    if (!r.ok) { alert((await r.json()).error ?? "Delete failed"); return; }
    refresh();
  }

  async function setDefault(row: ProviderRow) {
    const r = await apiFetch(`/api/storage-providers/${row.id}/default`, { method: "POST" });
    if (!r.ok) { alert((await r.json()).error ?? "Failed"); return; }
    refresh();
  }

  async function toggleEnabled(row: ProviderRow) {
    const r = await apiFetch(`/api/storage-providers/${row.id}`, {
      method: "PUT",
      body: JSON.stringify({ isEnabled: !row.isEnabled }),
    });
    if (!r.ok) { alert((await r.json()).error ?? "Failed"); return; }
    refresh();
  }

  return (
    <div>
      <PageHeader
        title="Storage Providers"
        description="Configure third-party storage destinations (AWS S3, S3-compatible, DigitalOcean Spaces, Google Cloud Storage, Azure Blob). Credentials are stored here for future use — uploads still go to the default Replit Object Storage."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add provider
          </Button>
        }
      />

      <Card className="mb-4 p-4 border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900">
        <div className="flex items-start gap-3 text-sm">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-200">Storage credentials only</p>
            <p className="text-amber-800/80 dark:text-amber-200/80 mt-0.5">
              You can save credentials here today. The upload flow will switch to the default provider in a future change.
            </p>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-4 mb-4">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {loading ? (
        <Card className="p-6"><p className="text-sm text-muted-foreground">Loading…</p></Card>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center">
          <HardDrive className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium">No storage providers configured</p>
          <p className="text-sm text-muted-foreground mt-1">Add an S3, GCS or Azure account to make it available to the app.</p>
          <div className="mt-4">
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add your first provider
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((row) => (
            <Card key={row.id} className="p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{row.name}</h3>
                    {row.isDefault && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        <Star className="h-3 w-3" /> Default
                      </span>
                    )}
                    {!row.isEnabled && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{row.typeLabel}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <HardDrive className="h-4 w-4 text-primary" />
                </div>
              </div>

              <dl className="text-xs space-y-1">
                {(row.config.bucket || row.config.container) && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-20 shrink-0">{row.config.bucket ? "Bucket" : "Container"}</dt>
                    <dd className="truncate font-mono">{row.config.bucket || row.config.container}</dd>
                  </div>
                )}
                {row.config.region && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-20 shrink-0">Region</dt>
                    <dd className="truncate font-mono">{row.config.region}</dd>
                  </div>
                )}
                {row.config.endpoint && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-20 shrink-0">Endpoint</dt>
                    <dd className="truncate font-mono">{row.config.endpoint}</dd>
                  </div>
                )}
                {row.config.projectId && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-20 shrink-0">Project</dt>
                    <dd className="truncate font-mono">{row.config.projectId}</dd>
                  </div>
                )}
                {row.config.accountName && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-20 shrink-0">Account</dt>
                    <dd className="truncate font-mono">{row.config.accountName}</dd>
                  </div>
                )}
                {row.config.prefix && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-20 shrink-0">Prefix</dt>
                    <dd className="truncate font-mono">{row.config.prefix}</dd>
                  </div>
                )}
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-20 shrink-0">Secret</dt>
                  <dd>
                    {Object.entries(row.hasSecret).map(([k, has]) => (
                      <span key={k} className="inline-flex items-center gap-1 mr-2">
                        {has ? (
                          <><CheckCircle2 className="h-3 w-3 text-emerald-600" /> {FIELD_LABELS[k] ?? k} saved</>
                        ) : (
                          <><AlertCircle className="h-3 w-3 text-amber-600" /> {FIELD_LABELS[k] ?? k} missing</>
                        )}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60 mt-auto">
                {!row.isDefault && (
                  <Button size="sm" variant="outline" onClick={() => setDefault(row)}>
                    <Star className="h-3 w-3 mr-1" /> Make default
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                  <Edit2 className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleEnabled(row)}>
                  {row.isEnabled ? (<><PowerOff className="h-3 w-3 mr-1" /> Disable</>) : (<><Power className="h-3 w-3 mr-1" /> Enable</>)}
                </Button>
                <button
                  onClick={() => remove(row)}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl border text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ProviderDialog
          types={types}
          row={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function ProviderDialog({
  types, row, onClose, onSaved,
}: {
  types: TypeMeta[];
  row: ProviderRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!row;
  const [name, setName] = useState(row?.name ?? "");
  const [type, setType] = useState<ProviderTypeKey>((row?.type as ProviderTypeKey) ?? (types[0]?.key ?? "s3"));
  const [config, setConfig] = useState<Record<string, any>>(() => ({ ...(row?.config ?? {}) }));
  const [isDefault, setIsDefault] = useState(!!row?.isDefault);
  const [isEnabled, setIsEnabled] = useState(row ? row.isEnabled : true);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const typeDef = useMemo(() => types.find((t) => t.key === type) ?? null, [types, type]);
  const secretSet = useMemo(() => new Set(typeDef?.secretFields ?? []), [typeDef]);

  function setField(key: string, value: any) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function changeType(next: ProviderTypeKey) {
    setType(next);
    // reset config when switching types in create mode (or when no row)
    if (!row || row.type !== next) {
      setConfig({});
    } else {
      setConfig({ ...row.config });
    }
  }

  async function save() {
    setErr(null);
    if (!name.trim()) { setErr("Name is required"); return; }
    setBusy(true);
    try {
      const payload: any = { name: name.trim(), type, isDefault, isEnabled, config };
      const r = isEdit
        ? await apiFetch(`/api/storage-providers/${row!.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await apiFetch(`/api/storage-providers`, { method: "POST", body: JSON.stringify(payload) });
      if (!r.ok) { setErr((await r.json()).error ?? "Save failed"); return; }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl border border-border shadow-lg w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">{isEdit ? "Edit storage provider" : "Add storage provider"}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Primary S3, Backups R2" />
          </div>

          <div>
            <Label>Type</Label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm w-full"
              value={type}
              onChange={(e) => changeType(e.target.value as ProviderTypeKey)}
              disabled={isEdit}
            >
              {types.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            {isEdit && <p className="text-xs text-muted-foreground mt-1">Type cannot be changed after creation.</p>}
          </div>

          {typeDef && (
            <div className="space-y-3 pt-1 border-t border-border/60">
              {typeDef.fields.map((field) => {
                const isSecret = secretSet.has(field);
                const isRequired = typeDef.required.includes(field);
                const hasSavedSecret = isSecret && row?.hasSecret?.[field];
                const isBool = field === "forcePathStyle";
                const isTextarea = field === "serviceAccountJson";
                const isRegionDropdown = type === "digitalocean_spaces" && field === "region";

                return (
                  <div key={field}>
                    <Label>
                      {FIELD_LABELS[field] ?? field}
                      {isRequired && <span className="text-destructive ml-0.5">*</span>}
                    </Label>

                    {isBool ? (
                      <label className="flex items-center gap-2 text-sm pt-1">
                        <input
                          type="checkbox"
                          checked={!!config[field]}
                          onChange={(e) => setField(field, e.target.checked)}
                        />
                        <span>Required for MinIO and some self-hosted S3 services</span>
                      </label>
                    ) : isRegionDropdown ? (
                      <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm w-full"
                        value={config[field] ?? ""}
                        onChange={(e) => setField(field, e.target.value)}
                      >
                        <option value="">Select a region…</option>
                        {DO_SPACES_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : isTextarea ? (
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono min-h-[140px]"
                        value={isSecret ? (config[field] ?? "") : (config[field] ?? "")}
                        placeholder={hasSavedSecret ? "•••• existing JSON saved — paste new JSON to replace" : FIELD_PLACEHOLDERS[field]}
                        onChange={(e) => setField(field, e.target.value)}
                      />
                    ) : isSecret ? (
                      <div className="relative">
                        <Input
                          type={showSecret[field] ? "text" : "password"}
                          value={config[field] ?? ""}
                          placeholder={hasSavedSecret ? "•••• saved — paste a new value to replace" : FIELD_PLACEHOLDERS[field]}
                          onChange={(e) => setField(field, e.target.value)}
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret((p) => ({ ...p, [field]: !p[field] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:bg-muted"
                          aria-label={showSecret[field] ? "Hide" : "Show"}
                        >
                          {showSecret[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    ) : (
                      <Input
                        value={config[field] ?? ""}
                        placeholder={FIELD_PLACEHOLDERS[field]}
                        onChange={(e) => setField(field, e.target.value)}
                      />
                    )}

                    {isSecret && hasSavedSecret && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Leave blank to keep the existing value.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-border/60">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              <span>Make this the default provider</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
              <span>Enabled</span>
            </label>
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : (isEdit ? "Save changes" : "Add provider")}</Button>
        </div>
      </div>
    </div>
  );
}
