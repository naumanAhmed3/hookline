import { db } from './db';
import { newId } from './ids';
import { nextAttemptAt } from './backoff';
import {
  buildSignature,
  EVENT_HEADER,
  ID_HEADER,
  SIGNATURE_HEADER,
} from './signing';
import type { Delivery, Endpoint, WebhookEvent } from './types';

// ─────────────────────────────────────────────────────────────
// The delivery engine. A delivery row is the queue item:
//   pending → delivering → (succeeded | pending+backoff | dead)
// Concurrency-safe via `FOR UPDATE SKIP LOCKED`, and a visibility
// timeout reclaims rows orphaned by a crashed worker.
// ─────────────────────────────────────────────────────────────

const HTTP_TIMEOUT_MS = 10_000;
const CONCURRENCY = 5;
const VISIBILITY_TIMEOUT = '2 minutes';

export interface DrainResult {
  reclaimed: number;
  claimed: number;
  succeeded: number;
  retried: number;
  dead: number;
}

/** Return rows stuck in `delivering` (crashed worker) to the queue. */
async function reclaimStuck(): Promise<number> {
  const rows = await db()`
    update deliveries set status = 'pending', updated_at = now()
    where status = 'delivering'
      and claimed_at < now() - ${VISIBILITY_TIMEOUT}::interval
    returning id`;
  return rows.length;
}

/**
 * Atomically claim up to `limit` due deliveries. SKIP LOCKED lets
 * multiple workers drain the same queue without ever colliding.
 */
async function claimDue(limit: number): Promise<Delivery[]> {
  return db()<Delivery[]>`
    update deliveries
    set status = 'delivering', claimed_at = now(), updated_at = now()
    where id in (
      select id from deliveries
      where status = 'pending' and next_attempt_at <= now()
      order by next_attempt_at
      limit ${limit}
      for update skip locked
    )
    returning *`;
}

/** Perform one HTTP attempt for a claimed delivery and settle its state. */
async function attemptDelivery(
  delivery: Delivery,
): Promise<'succeeded' | 'retried' | 'dead'> {
  const sql = db();
  const [event] = await sql<WebhookEvent[]>`
    select * from events where id = ${delivery.event_id}`;
  const [endpoint] = await sql<Endpoint[]>`
    select * from endpoints where id = ${delivery.endpoint_id}`;
  const attemptNumber = delivery.attempt_count + 1;

  const body = JSON.stringify({
    id: event.id,
    type: event.event_type,
    created_at: event.created_at,
    data: event.payload,
  });

  let ok = false;
  let statusCode: number | null = null;
  let error: string | null = null;
  let snippet: string | null = null;
  const start = Date.now();
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Hookline/1.0',
        [SIGNATURE_HEADER]: buildSignature(endpoint.secret, body),
        [ID_HEADER]: delivery.id,
        [EVENT_HEADER]: event.event_type,
      },
      body,
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    statusCode = res.status;
    ok = res.ok;
    snippet = (await res.text().catch(() => '')).slice(0, 500);
    if (!ok) error = `Receiver responded ${res.status}`;
  } catch (e) {
    if (e instanceof Error) {
      error = e.name === 'TimeoutError' ? 'Request timed out after 10s' : e.message;
    } else {
      error = 'Request failed';
    }
  }
  const duration = Date.now() - start;

  // Immutable audit row for this attempt.
  await sql`
    insert into delivery_attempts
      (id, delivery_id, attempt_number, ok, status_code, error, response_snippet, duration_ms)
    values
      (${newId('att')}, ${delivery.id}, ${attemptNumber}, ${ok}, ${statusCode},
       ${error}, ${snippet}, ${duration})`;

  if (ok) {
    await sql`
      update deliveries
      set status = 'succeeded', attempt_count = ${attemptNumber},
          last_error = null, updated_at = now()
      where id = ${delivery.id}`;
    return 'succeeded';
  }

  if (attemptNumber >= delivery.max_attempts) {
    await sql`
      update deliveries
      set status = 'dead', attempt_count = ${attemptNumber},
          last_error = ${error}, updated_at = now()
      where id = ${delivery.id}`;
    return 'dead';
  }

  await sql`
    update deliveries
    set status = 'pending', attempt_count = ${attemptNumber}, last_error = ${error},
        next_attempt_at = ${nextAttemptAt(attemptNumber)}, updated_at = now()
    where id = ${delivery.id}`;
  return 'retried';
}

/** Drain the queue once: reclaim, claim, then deliver with a worker pool. */
export async function drainQueue(limit = 25): Promise<DrainResult> {
  const reclaimed = await reclaimStuck();
  const claimed = await claimDue(limit);
  const result: DrainResult = {
    reclaimed,
    claimed: claimed.length,
    succeeded: 0,
    retried: 0,
    dead: 0,
  };

  let cursor = 0;
  async function poolWorker() {
    while (cursor < claimed.length) {
      const delivery = claimed[cursor++];
      try {
        const outcome = await attemptDelivery(delivery);
        result[outcome]++;
      } catch {
        // An unexpected error must not strand the row in `delivering`.
        await db()`
          update deliveries set status = 'pending', updated_at = now()
          where id = ${delivery.id} and status = 'delivering'`;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, claimed.length) }, poolWorker),
  );
  return result;
}

/** Re-queue a delivery from scratch — used for manual replay from the DLQ. */
export async function requeueDelivery(id: string): Promise<boolean> {
  const rows = await db()`
    update deliveries
    set status = 'pending', attempt_count = 0, last_error = null,
        next_attempt_at = now(), claimed_at = null, updated_at = now()
    where id = ${id} and status in ('dead', 'succeeded', 'failed')
    returning id`;
  return rows.length > 0;
}
