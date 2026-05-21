import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// ─────────────────────────────────────────────────────────────
// Webhook payload signing — Stripe-style. The receiver recomputes
// HMAC-SHA256 over `${timestamp}.${rawBody}` with the shared secret
// and compares in constant time. The timestamp also lets receivers
// reject replayed requests outside a tolerance window.
// ─────────────────────────────────────────────────────────────

export const SIGNATURE_HEADER = 'hookline-signature';
export const ID_HEADER = 'hookline-id';
export const EVENT_HEADER = 'hookline-event';

/** Build the `Hookline-Signature: t=<ts>,v1=<hex>` header value. */
export function buildSignature(
  secret: string,
  body: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): string {
  const v1 = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

/**
 * Verify a signature header against the raw body. Returns false on any
 * malformed input, signature mismatch, or excessive clock skew.
 */
export function verifySignature(
  secret: string,
  body: string,
  header: string | null,
  toleranceSeconds = 300,
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((kv) => kv.split('=').map((s) => s.trim()) as [string, string]),
  );
  const ts = Number(parts.t);
  const provided = parts.v1;
  if (!ts || !provided) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > toleranceSeconds) return false;

  const expected = createHmac('sha256', secret)
    .update(`${ts}.${body}`)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A random endpoint signing secret. */
export function newSecret(): string {
  return 'whsec_' + randomBytes(24).toString('hex');
}
