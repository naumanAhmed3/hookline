import { NextResponse } from 'next/server';
import { ingestEvent } from '@/lib/repo';
import { drainQueue } from '@/lib/worker';
import { authError, requireIngest } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/ingest — accept an event, fan it out to every enabled
// endpoint, and immediately attempt delivery. An `Idempotency-Key`
// header makes ingestion exactly-once.
export async function POST(req: Request) {
  try {
    requireIngest(req);
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const obj = body as Record<string, unknown>;
  const eventType = typeof obj?.event_type === 'string' ? obj.event_type.trim() : '';
  if (!eventType) {
    return NextResponse.json({ error: '`event_type` is required' }, { status: 400 });
  }
  const payload =
    obj?.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
      ? (obj.payload as Record<string, unknown>)
      : {};

  const idempotencyKey = req.headers.get('idempotency-key');

  const { event, created, deliveryIds } = await ingestEvent({
    event_type: eventType,
    payload,
    idempotency_key: idempotencyKey,
    source: 'api',
  });

  // Attempt delivery inline so the caller sees the first result;
  // failed deliveries are retried later by the scheduled drain.
  const drain = await drainQueue();

  return NextResponse.json(
    { event_id: event.id, deduplicated: !created, deliveries_created: deliveryIds.length, drain },
    { status: created ? 202 : 200 },
  );
}
