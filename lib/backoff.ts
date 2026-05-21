// ─────────────────────────────────────────────────────────────
// Retry schedule — exponential backoff with full jitter. Jitter
// spreads retries so a fleet of failed deliveries doesn't all
// stampede the receiver at the same instant ("thundering herd").
// ─────────────────────────────────────────────────────────────

const BASE_MS = 10_000; // first retry ~10s out
const FACTOR = 4;
const CAP_MS = 60 * 60 * 1000; // never wait more than an hour

/** Delay before retry N (1-indexed), in milliseconds. */
export function backoffMs(attemptNumber: number): number {
  const exponential = Math.min(BASE_MS * FACTOR ** (attemptNumber - 1), CAP_MS);
  // Full jitter: a uniform random point in [0, exponential].
  return Math.round(Math.random() * exponential);
}

/** The wall-clock time of the next attempt. */
export function nextAttemptAt(attemptNumber: number): Date {
  return new Date(Date.now() + backoffMs(attemptNumber));
}

/** Human-readable preview of the retry schedule, for docs/UI. */
export function retrySchedulePreview(maxAttempts: number): string[] {
  const out: string[] = [];
  for (let n = 1; n < maxAttempts; n++) {
    const typical = Math.min(BASE_MS * FACTOR ** (n - 1), CAP_MS) / 2;
    out.push(typical >= 60_000 ? `~${Math.round(typical / 60_000)}m` : `~${Math.round(typical / 1000)}s`);
  }
  return out;
}
