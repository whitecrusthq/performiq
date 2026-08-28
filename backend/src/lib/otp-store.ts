const OTP_TTL_MS = 10 * 60 * 1000;

interface OtpEntry {
  otp: string;
  expiresAt: number;
  attempts: number;
  tokenVersion?: number;
}

const store = new Map<string, OtpEntry>();

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function storeOtp(email: string, otp: string, tokenVersion?: number): void {
  store.set(email.toLowerCase().trim(), {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    tokenVersion,
  });
}

export function verifyOtp(email: string, otp: string, tokenVersion?: number): "valid" | "invalid" | "expired" | "too_many_attempts" {
  const key = email.toLowerCase().trim();
  const entry = store.get(key);
  if (!entry) return "invalid";
  if (tokenVersion !== undefined && entry.tokenVersion !== tokenVersion) {
    store.delete(key);
    return "expired";
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return "expired";
  }
  entry.attempts += 1;
  if (entry.attempts > 5) {
    store.delete(key);
    return "too_many_attempts";
  }
  if (entry.otp !== otp) return "invalid";
  store.delete(key);
  return "valid";
}
