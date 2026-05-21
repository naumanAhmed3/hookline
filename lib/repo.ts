import { db } from './db';
import { newId } from './ids';
import { newSecret } from './signing';
import type {
  Delivery,
  DeliveryAttempt,
  DeliveryRow,
  DeliveryStatus,
  Endpoint,
  WebhookEvent,
} from './types';

// ─────────────────────────────────────────────────────────────
// Data access. Queue-critical statements (claim / requeue) live in
// worker.ts; everything else is here.
// ─────────────────────────────────────────────────────────────

// ── Endpoints ────────────────────────────────────────────────
export async function listEndpoints(): Promise<Endpoint[]> {
  return db()<Endpoint[]>`select * from endpoints order by created_at desc`;
}

export async function getEndpoint(id: string): Promise<Endpoint | null> {
  const [row] = await db()<Endpoint[]>`select * from endpoints where id = ${id}`;
  return row ?? null;
}

export async function createEndpoint(name: string, url: string): Promise<Endpoint> {
  const [row] = await db()<Endpoint[]>`
    insert into endpoints (id, name, url, secret)
    values (${newId('ep')}, ${name}, ${url}, ${newSecret()})
    returning *`;
  return row;
}

export async function setEndpointEnabled(id: string, enabled: boolean): Promise<void> {
  await db()`update endpoints set enabled = ${enabled} where id = ${id}`;
}

export async function deleteEndpoint(id: string): Promise<void> {
  await db()`delete from endpoints where id = ${id}`;
}

// ── Events ───────────────────────────────────────────────────
export interface CreateEventInput {
  event_type: string;
  payload: Record<string, unknown>;
  idempotency_key?: string | null;
  source?: string | null;
}

/**
 * Insert an event. If an idempotency key collides with an existing
 * event, the existing event is returned and `created` is false — the
 * caller then skips fan-out, giving exactly-once ingestion.
 */
export async function createEvent(
  input: CreateEventInput,
): Promise<{ event: WebhookEvent; created: boolean }> {
  const rows = await db()<(WebhookEvent & { inserted: boolean })[]>`
    insert into events (id, event_type, payload, idempotency_key, source)
    values (
      ${newId('evt')}, ${input.event_type}, ${db().json(input.payload as never)},
      ${input.idempotency_key ?? null}, ${input.source ?? null}
    )
    on conflict (idempotency_key) do update set event_type = events.event_type
    returning *, (xmax = 0) as inserted`;
  const row = rows[0];
  const { inserted, ...event } = row;
  return { event, created: inserted };
}

export async function getEvent(id: string): Promise<WebhookEvent | null> {
  const [row] = await db()<WebhookEvent[]>`select * from events where id = ${id}`;
  return row ?? null;
}

// ── Deliveries ───────────────────────────────────────────────
/** Fan an event out to one delivery per enabled endpoint. */
export async function fanOutDeliveries(eventId: string): Promise<string[]> {
  const endpoints = await db()<{ id: string }[]>`
    select id from endpoints where enabled = true`;
  if (endpoints.length === 0) return [];
  const values = endpoints.map((e) => ({
    id: newId('del'),
    event_id: eventId,
    endpoint_id: e.id,
  }));
  await db()`insert into deliveries ${db()(values, 'id', 'event_id', 'endpoint_id')}`;
  return values.map((v) => v.id);
}

export async function getDelivery(id: string): Promise<Delivery | null> {
  const [row] = await db()<Delivery[]>`select * from deliveries where id = ${id}`;
  return row ?? null;
}

export interface DeliveryFilter {
  status?: DeliveryStatus;
  endpointId?: string;
  limit?: number;
}

export async function listDeliveries(filter: DeliveryFilter = {}): Promise<DeliveryRow[]> {
  const sql = db();
  const limit = Math.min(filter.limit ?? 100, 500);
  return sql<DeliveryRow[]>`
    select d.*, e.event_type, ep.name as endpoint_name, ep.url as endpoint_url
    from deliveries d
    join events e on e.id = d.event_id
    join endpoints ep on ep.id = d.endpoint_id
    where ${filter.status ? sql`d.status = ${filter.status}` : sql`true`}
      and ${filter.endpointId ? sql`d.endpoint_id = ${filter.endpointId}` : sql`true`}
    order by d.created_at desc
    limit ${limit}`;
}

export async function getDeliveryRow(id: string): Promise<DeliveryRow | null> {
  const [row] = await db()<DeliveryRow[]>`
    select d.*, e.event_type, ep.name as endpoint_name, ep.url as endpoint_url
    from deliveries d
    join events e on e.id = d.event_id
    join endpoints ep on ep.id = d.endpoint_id
    where d.id = ${id}`;
  return row ?? null;
}

export async function listAttempts(deliveryId: string): Promise<DeliveryAttempt[]> {
  return db()<DeliveryAttempt[]>`
    select * from delivery_attempts
    where delivery_id = ${deliveryId}
    order by attempt_number asc`;
}

// ── Stats ────────────────────────────────────────────────────
export interface Stats {
  events: number;
  deliveries: number;
  pending: number;
  succeeded: number;
  dead: number;
  successRate: number;
  endpoints: number;
}

export async function getStats(): Promise<Stats> {
  const sql = db();
  const [[ev], [ep], byStatus] = await Promise.all([
    sql<{ c: number }[]>`select count(*)::int as c from events`,
    sql<{ c: number }[]>`select count(*)::int as c from endpoints`,
    sql<{ status: DeliveryStatus; c: number }[]>`
      select status, count(*)::int as c from deliveries group by status`,
  ]);
  const map = new Map(byStatus.map((r) => [r.status, r.c]));
  const succeeded = map.get('succeeded') ?? 0;
  const dead = map.get('dead') ?? 0;
  const pending = (map.get('pending') ?? 0) + (map.get('delivering') ?? 0);
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  const settled = succeeded + dead;
  return {
    events: ev.c,
    deliveries: total,
    pending,
    succeeded,
    dead,
    successRate: settled === 0 ? 1 : succeeded / settled,
    endpoints: ep.c,
  };
}
