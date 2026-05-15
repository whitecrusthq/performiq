import StorageProvider from "../models/StorageProvider.js";
import sequelize from "../db/sequelize.js";
import { encryptSecretIfPresent, isEncryptedSecret, decryptSecret } from "../lib/secret-cipher.js";

/**
 * Supported provider types and their config schemas.
 * `secretFields` lists JSON keys whose values are masked when returned to the client.
 */
export const PROVIDER_TYPES = {
  s3: {
    label: "Amazon S3",
    fields: ["region", "bucket", "accessKeyId", "secretAccessKey", "prefix"],
    required: ["region", "bucket", "accessKeyId", "secretAccessKey"],
    secretFields: ["secretAccessKey"],
  },
  s3_compatible: {
    label: "S3-compatible (Cloudflare R2, Backblaze B2, MinIO, etc.)",
    fields: ["endpoint", "region", "bucket", "accessKeyId", "secretAccessKey", "forcePathStyle", "prefix"],
    required: ["endpoint", "bucket", "accessKeyId", "secretAccessKey"],
    secretFields: ["secretAccessKey"],
  },
  digitalocean_spaces: {
    label: "DigitalOcean Spaces",
    fields: ["region", "bucket", "accessKeyId", "secretAccessKey", "prefix"],
    required: ["region", "bucket", "accessKeyId", "secretAccessKey"],
    secretFields: ["secretAccessKey"],
  },
  gcs: {
    label: "Google Cloud Storage",
    fields: ["projectId", "bucket", "serviceAccountJson", "prefix"],
    required: ["projectId", "bucket", "serviceAccountJson"],
    secretFields: ["serviceAccountJson"],
  },
  azure: {
    label: "Azure Blob Storage",
    fields: ["accountName", "container", "accountKey", "prefix"],
    required: ["accountName", "container", "accountKey"],
    secretFields: ["accountKey"],
  },
} as const;

export type ProviderType = keyof typeof PROVIDER_TYPES;

function isValidType(t: any): t is ProviderType {
  return typeof t === "string" && Object.prototype.hasOwnProperty.call(PROVIDER_TYPES, t);
}

function maskSecret(v: any): string {
  if (typeof v !== "string" || !v) return "";
  if (v.length <= 8) return "•".repeat(v.length);
  return `${"•".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}`;
}

function maskConfig(type: ProviderType, config: Record<string, any>) {
  const def = PROVIDER_TYPES[type];
  const secretSet = new Set<string>(def.secretFields);
  const out: Record<string, any> = {};
  const hasSecret: Record<string, boolean> = {};
  for (const k of def.fields) {
    const v = config?.[k];
    if (secretSet.has(k)) {
      // present if either a plaintext (legacy/in-flight) value or an envelope is stored
      hasSecret[k] = !!(typeof v === "string" && v.length > 0);
      out[k] = "";
    } else {
      out[k] = v ?? "";
    }
  }
  return { config: out, hasSecret };
}

function sanitizeIncomingConfig(
  type: ProviderType,
  incoming: Record<string, any> | undefined,
  existing: Record<string, any> | null
): { ok: true; config: Record<string, any> } | { ok: false; error: string } {
  const def = PROVIDER_TYPES[type];
  const allowed = new Set<string>(def.fields);
  const secretSet = new Set<string>(def.secretFields);
  const merged: Record<string, any> = {};

  // start with existing values so unspecified keys are preserved
  if (existing && typeof existing === "object") {
    for (const k of def.fields) if (existing[k] !== undefined) merged[k] = existing[k];
  }

  if (incoming && typeof incoming === "object") {
    for (const [k, raw] of Object.entries(incoming)) {
      if (!allowed.has(k)) continue;
      if (secretSet.has(k)) {
        // empty string -> keep existing; explicit null -> clear; otherwise encrypt+replace
        if (raw === null) merged[k] = "";
        else if (typeof raw === "string" && raw.length > 0) merged[k] = encryptSecretIfPresent(raw);
        // empty string => leave merged[k] as existing (still encrypted)
      } else if (k === "forcePathStyle") {
        merged[k] = !!raw;
      } else if (typeof raw === "string") {
        merged[k] = raw.trim();
      } else if (raw == null) {
        merged[k] = "";
      } else {
        merged[k] = String(raw);
      }
    }
  }

  for (const r of def.required) {
    const v = merged[r];
    if (v === undefined || v === null || v === "") {
      return { ok: false, error: `Field "${r}" is required for ${def.label}` };
    }
  }
  // light JSON validation for GCS service account (decrypt envelope first if needed)
  if (type === "gcs" && merged.serviceAccountJson) {
    let candidate = merged.serviceAccountJson as string;
    if (isEncryptedSecret(candidate)) {
      try { candidate = decryptSecret(candidate); }
      catch { return { ok: false, error: "Stored serviceAccountJson could not be read" }; }
    }
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== "object" || !parsed.client_email || !parsed.private_key) {
        return { ok: false, error: "serviceAccountJson must be a valid Google service account JSON" };
      }
    } catch {
      return { ok: false, error: "serviceAccountJson is not valid JSON" };
    }
  }

  return { ok: true, config: merged };
}

function format(row: StorageProvider) {
  const type = row.type as ProviderType;
  const def = isValidType(type) ? PROVIDER_TYPES[type] : null;
  const { config, hasSecret } = def
    ? maskConfig(type, row.config ?? {})
    : { config: row.config ?? {}, hasSecret: {} };
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    typeLabel: def?.label ?? row.type,
    isDefault: !!row.isDefault,
    isEnabled: !!row.isEnabled,
    config,
    hasSecret,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export default class StorageProviderController {
  static metadata() {
    return {
      types: Object.entries(PROVIDER_TYPES).map(([key, def]) => ({
        key,
        label: def.label,
        fields: def.fields,
        required: def.required,
        secretFields: def.secretFields,
      })),
    };
  }

  static async list() {
    const rows = await StorageProvider.findAll({ order: [["createdAt", "DESC"]] });
    return rows.map(format);
  }

  static async create(data: any, userId: number | null) {
    const name = String(data?.name ?? "").trim();
    if (!name) return { error: "Name is required", status: 400 } as const;
    if (!isValidType(data?.type)) return { error: "Unsupported storage type", status: 400 } as const;

    const sanitized = sanitizeIncomingConfig(data.type, data?.config, null);
    if (!sanitized.ok) return { error: sanitized.error, status: 400 } as const;

    const isDefault = !!data?.isDefault;
    const isEnabled = data?.isEnabled === false ? false : true;
    if (isDefault && !isEnabled) {
      return { error: "A disabled provider cannot be the default. Enable it first.", status: 400 } as const;
    }

    const row = await sequelize.transaction(async (t) => {
      if (isDefault) {
        await StorageProvider.update({ isDefault: false }, { where: { isDefault: true }, transaction: t });
      }
      return StorageProvider.create(
        {
          name,
          type: data.type,
          config: sanitized.config,
          isDefault,
          isEnabled,
          createdBy: userId,
        },
        { transaction: t }
      );
    });

    return { data: format(row) } as const;
  }

  static async update(id: number, data: any) {
    const row = await StorageProvider.findByPk(id);
    if (!row) return { error: "Not found", status: 404 } as const;

    const updates: any = { updatedAt: new Date() };

    if (data?.name !== undefined) {
      const name = String(data.name).trim();
      if (!name) return { error: "Name cannot be empty", status: 400 } as const;
      updates.name = name;
    }

    let nextType: ProviderType = row.type as ProviderType;
    if (data?.type !== undefined) {
      if (!isValidType(data.type)) return { error: "Unsupported storage type", status: 400 } as const;
      nextType = data.type;
      updates.type = data.type;
    }

    if (data?.config !== undefined || data?.type !== undefined) {
      // if type changed, don't carry over old keys
      const baseExisting = nextType === (row.type as ProviderType) ? (row.config as any) : null;
      const sanitized = sanitizeIncomingConfig(nextType, data?.config, baseExisting);
      if (!sanitized.ok) return { error: sanitized.error, status: 400 } as const;
      updates.config = sanitized.config;
    }

    if (data?.isEnabled !== undefined) updates.isEnabled = !!data.isEnabled;

    // Invariant: a disabled provider cannot be (or remain) the default.
    const willBeEnabled = updates.isEnabled !== undefined ? updates.isEnabled : row.isEnabled;
    const willBeDefault =
      data?.isDefault === true ? true :
      data?.isDefault === false ? false :
      row.isDefault;
    if (willBeDefault && !willBeEnabled) {
      return { error: "A disabled provider cannot be the default. Enable it first.", status: 400 } as const;
    }

    await sequelize.transaction(async (t) => {
      if (data?.isDefault === true) {
        await StorageProvider.update(
          { isDefault: false },
          { where: { isDefault: true }, transaction: t }
        );
        updates.isDefault = true;
      } else if (data?.isDefault === false) {
        updates.isDefault = false;
      }
      await StorageProvider.update(updates, { where: { id }, transaction: t });
    });

    const fresh = await StorageProvider.findByPk(id);
    return { data: format(fresh!) } as const;
  }

  static async remove(id: number) {
    const row = await StorageProvider.findByPk(id);
    if (!row) return { error: "Not found", status: 404 } as const;
    await row.destroy();
    return { data: { ok: true } } as const;
  }

  static async setDefault(id: number) {
    const row = await StorageProvider.findByPk(id);
    if (!row) return { error: "Not found", status: 404 } as const;
    if (!row.isEnabled) {
      return { error: "A disabled provider cannot be the default. Enable it first.", status: 400 } as const;
    }
    await sequelize.transaction(async (t) => {
      await StorageProvider.update({ isDefault: false }, { where: { isDefault: true }, transaction: t });
      await StorageProvider.update({ isDefault: true, updatedAt: new Date() }, { where: { id }, transaction: t });
    });
    const fresh = await StorageProvider.findByPk(id);
    return { data: format(fresh!) } as const;
  }
}
