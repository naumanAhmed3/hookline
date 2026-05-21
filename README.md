# Hookline — Webhook Delivery Gateway

A reliable **webhook delivery gateway**. You hand Hookline an event; it
fans the event out to every registered endpoint, **signs** each request,
**retries** failures with exponential backoff, parks exhausted deliveries
in a **dead-letter queue**, and keeps an immutable **audit trail** of
every attempt — all replayable from a dashboard.

**[▶ Live demo](https://hookline-six.vercel.app)** · **[Repo](https://github.com/naumanAhmed3/hookline)**

---

## Why this exists

Sending a webhook is one line of code. Sending it *reliably* is a
system: receivers go down, time out, rate-limit, and flake. A real
gateway has to answer — what happens on failure? how many retries, how
far apart? how do you not hammer a struggling receiver? how does the
receiver trust the request? what happens to a delivery that never
succeeds? how do you replay it later?

Hookline is that system, small enough to read in one sitting.

## What it does

| Capability | How |
|---|---|
| **Idempotent ingestion** | An `Idempotency-Key` header dedupes events at the unique index — exactly-once intake |
| **Fan-out** | Each event becomes one `delivery` row per enabled endpoint |
| **Signed payloads** | `Hookline-Signature: t=…,v1=…` — HMAC-SHA256 over `timestamp.body`, verified in constant time (Stripe-style) |
| **Exponential backoff + jitter** | Retries at ~10s, 40s, 2.7m… with full jitter to avoid a thundering herd |
| **Dead-letter queue** | After `max_attempts`, a delivery is parked as `dead` for inspection |
| **Replay** | Any settled or dead delivery can be re-queued from a clean slate |
| **Audit trail** | Every attempt records status, latency, error and a response snippet |

## Architecture

```
 POST /api/ingest ─▶ events ─┐
                             ├─▶ deliveries (the queue)
       endpoints ────────────┘        │
                                      ▼
   Vercel Cron ─▶ /api/deliveries/process ─▶ drainQueue()
                                      │
                  reclaim stuck ─ claim due ─ deliver ─ settle
                                      │
                              delivery_attempts (audit)
```

**The delivery row *is* the queue item.** Its lifecycle:

```
pending ─▶ delivering ─▶ succeeded
                      └▶ pending (+backoff)  ─▶ … ─▶ dead
```

The queue is drained with a real Postgres work-queue pattern:

```sql
update deliveries set status = 'delivering', claimed_at = now()
where id in (
  select id from deliveries
  where status = 'pending' and next_attempt_at <= now()
  order by next_attempt_at
  limit $1
  for update skip locked   -- many workers, zero collisions
)
returning *;
```

`FOR UPDATE SKIP LOCKED` lets any number of workers drain the same queue
concurrently without ever grabbing the same row. A **visibility
timeout** reclaims rows orphaned by a worker that crashed mid-delivery.

Delivery is triggered two ways: **inline** on ingest (so the caller sees
the first result immediately) and by a scheduled **Vercel Cron** (the
retry backstop). The dashboard's "Process queue now" button drains on
demand.

## Tech

- **TypeScript** throughout, strict
- **Next.js 16** (App Router) — API routes + server-rendered dashboard
- **Postgres** via `postgres.js` — hand-written SQL, no ORM, so the
  queue mechanics are visible
- **Vercel** — serverless functions + Cron
- **Tailwind CSS v4**

## API

```http
POST /api/ingest
Idempotency-Key: <optional>
{ "event_type": "order.created", "payload": { ... } }
→ 202 { event_id, deliveries, drain }

POST /api/deliveries/process            drain the queue once
POST /api/deliveries/:id/replay         re-queue a delivery
GET  /api/endpoints                     list endpoints
POST /api/endpoints                     { name, url }
PATCH/DELETE /api/endpoints/:id         toggle / remove
POST /api/sink?behavior=ok|flaky|fail|slow   built-in test receiver
```

### Verifying a signature (receiver side)

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

function verify(secret: string, body: string, header: string): boolean {
  const { t, v1 } = Object.fromEntries(
    header.split(',').map((kv) => kv.split('=')),
  );
  const expected = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
```

## Run it

```bash
pnpm install

# 1. Point DATABASE_URL at a Postgres database (Neon works great)
echo 'DATABASE_URL=postgres://…' > .env.local

# 2. Apply the schema
node --env-file=.env.local scripts/migrate.mjs

# 3. Develop
pnpm dev
```

The built-in `/api/sink` test receiver means you can demo retries and
the dead-letter queue end-to-end without any external service: add a
"Flaky receiver" or "Always fails" endpoint from the dashboard and send
a test event.

## Project layout

```
app/
  api/ingest            event intake + fan-out
  api/deliveries/...    queue drain + replay
  api/endpoints/...     endpoint management
  api/sink              configurable mock receiver
  page.tsx              delivery dashboard
  endpoints/            endpoint manager
  deliveries/[id]/      attempt timeline + replay
lib/
  worker.ts             the delivery engine (claim / attempt / settle)
  repo.ts               data access
  signing.ts            HMAC signing + verification
  backoff.ts            exponential backoff with jitter
  schema.sql            the four tables
```
