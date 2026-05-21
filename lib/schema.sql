-- Hookline schema — webhook delivery gateway.
-- Apply with: node scripts/migrate.mjs

create table if not exists endpoints (
  id          text primary key,
  name        text not null,
  url         text not null,
  secret      text not null,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists events (
  id              text primary key,
  event_type      text not null,
  payload         jsonb not null,
  idempotency_key text unique,
  source          text,
  created_at      timestamptz not null default now()
);

-- One delivery per (event x endpoint). This row IS the queue item.
--   status: pending | delivering | succeeded | failed | dead
create table if not exists deliveries (
  id              text primary key,
  event_id        text not null references events(id) on delete cascade,
  endpoint_id     text not null references endpoints(id) on delete cascade,
  status          text not null default 'pending',
  attempt_count   int  not null default 0,
  max_attempts    int  not null default 6,
  next_attempt_at timestamptz not null default now(),
  claimed_at      timestamptz,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Partial index: the worker only ever scans for due, pending rows.
create index if not exists deliveries_due_idx
  on deliveries (next_attempt_at)
  where status = 'pending';

create index if not exists deliveries_status_idx on deliveries (status);

-- An immutable record of every delivery attempt — the audit trail.
create table if not exists delivery_attempts (
  id               text primary key,
  delivery_id      text not null references deliveries(id) on delete cascade,
  attempt_number   int  not null,
  ok               boolean not null,
  status_code      int,
  error            text,
  response_snippet text,
  duration_ms      int  not null,
  attempted_at     timestamptz not null default now()
);

create index if not exists attempts_delivery_idx
  on delivery_attempts (delivery_id, attempt_number);
