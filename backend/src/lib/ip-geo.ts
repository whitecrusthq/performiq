import { logger } from "./logger.js";

export interface IpGeo {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  const v = ip.replace(/^::ffff:/, "");
  if (v === "127.0.0.1" || v === "::1" || v === "localhost") return true;
  if (v.startsWith("10.")) return true;
  if (v.startsWith("192.168.")) return true;
  if (v.startsWith("169.254.")) return true;
  const m = v.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

/**
 * Resolve approximate geolocation for an IP address using ipwho.is.
 *  - Free, HTTPS, no API key, generous rate limits.
 *  - 2 second timeout; all errors are swallowed (returns null).
 *  - Set AUTH_AUDIT_GEO=off in the environment to disable lookups entirely
 *    (audit rows still get written; country/city are just left null).
 */
export async function getGeoFromIp(ip: string | null | undefined): Promise<IpGeo | null> {
  if (!ip) return null;
  if ((process.env.AUTH_AUDIT_GEO ?? "on").toLowerCase() === "off") return null;

  const cleanIp = ip.replace(/^::ffff:/, "");
  if (isPrivateIp(cleanIp)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const url = `https://ipwho.is/${encodeURIComponent(cleanIp)}?fields=success,country,region,city,latitude,longitude`;
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    if (data?.success !== true) return null;
    return {
      country: data.country || undefined,
      region: data.region || undefined,
      city: data.city || undefined,
      latitude: typeof data.latitude === "number" ? data.latitude : undefined,
      longitude: typeof data.longitude === "number" ? data.longitude : undefined,
    };
  } catch (err) {
    logger.warn({ err, ip: cleanIp }, "IP geolocation lookup failed");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
