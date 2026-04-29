import speakeasy from "speakeasy";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const ISSUER = "PerformIQ";

export function generateSecret(label: string) {
  const secret = speakeasy.generateSecret({
    name: `${ISSUER} (${label})`,
    issuer: ISSUER,
    length: 20,
  });
  return {
    base32: secret.base32,
    otpauthUrl: secret.otpauth_url ?? "",
  };
}

export async function generateQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: "M", width: 240, margin: 1 });
}

export function verifyToken(secretBase32: string, token: string): boolean {
  if (!secretBase32 || !token) return false;
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: "base32",
    token: token.trim(),
    window: 1,
  });
}

export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map(c => bcrypt.hash(c, 8)));
}

export async function consumeBackupCode(
  hashedCodes: string[],
  attempt: string
): Promise<{ ok: boolean; remaining: string[] }> {
  const normalized = attempt.trim().toUpperCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(normalized, hashedCodes[i])) {
      const remaining = [...hashedCodes.slice(0, i), ...hashedCodes.slice(i + 1)];
      return { ok: true, remaining };
    }
  }
  return { ok: false, remaining: hashedCodes };
}
