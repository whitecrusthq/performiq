const OTP_TTL_MS = 10 * 60 * 1000;

interface OtpEntry {
  otp: string;
  expiresAt: number;
  attempts: number;
}

const store = new Map<string, OtpEntry>();

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function storeOtp(email: string, otp: string): void {
  store.set(email.toLowerCase(), {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
}

export function verifyOtp(email: string, otp: string): "valid" | "invalid" | "expired" | "too_many_attempts" {
  const key = email.toLowerCase();
  const entry = store.get(key);
  if (!entry) return "invalid";
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
