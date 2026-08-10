import { randomBytes, timingSafeEqual } from "node:crypto";

export function createCapabilityToken(): string {
  return randomBytes(24).toString("base64url");
}

export function verifyCapabilityToken(expected: string, actual: string | null): boolean {
  if (!actual) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  if (expectedBytes.length !== actualBytes.length) return false;
  return timingSafeEqual(expectedBytes, actualBytes);
}

export function isAllowedHost(host: string | null, expected: string): boolean {
  return host === expected;
}

export function isAllowedOrigin(origin: string | null, expected: string): boolean {
  return origin === expected;
}
