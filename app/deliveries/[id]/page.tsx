import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDeliveryRow, getEvent, listAttempts } from '@/lib/repo';
import { relativeTime } from '@/lib/format';
import { Nav } from '../../nav';
import { StatusBadge } from '../../page';
import { ReplayButton } from './replay-button';

export const dynamic = 'force-dynamic';

export default async function DeliveryDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const delivery = await getDeliveryRow(id).catch(() => null);
  if (!delivery) notFound();

  const [attempts, event] = await Promise.all([
    listAttempts(id),
    getEvent(delivery.event_id),
  ]);

  const replayable = ['dead', 'succeeded', 'failed'].includes(delivery.status);

  return (
    <div className="min-h-screen">
      <Nav active="overview" />
      <main className="max-w-3xl mx-auto px-6 py-6">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Back to deliveries
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mt-3 mb-5 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5">
              <StatusBadge status={delivery.status} />
              <span className="font-mono text-sm">{delivery.event_type}</span>
            </div>
            <div className="text-sm text-neutral-500 mt-1.5">
              → {delivery.endpoint_name}{' '}
              <span className="font-mono text-neutral-600">{delivery.endpoint_url}</span>
            </div>
          </div>
          {replayable && <ReplayButton id={delivery.id} />}
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Meta label="Attempts" value={`${delivery.attempt_count} / ${delivery.max_attempts}`} />
          <Meta label="Created" value={relativeTime(delivery.created_at)} />
          <Meta
            label="Next attempt"
            value={
              delivery.status === 'pending'
                ? relativeTime(delivery.next_attempt_at)
                : '—'
            }
          />
          <Meta label="Delivery ID" value={delivery.id} mono />
        </div>

        {delivery.last_error && (
          <div className="mb-5 rounded-lg bg-rose-500/10 ring-1 ring-rose-500/30 px-3 py-2 text-sm text-rose-300">
            {delivery.last_error}
          </div>
        )}

        {/* Payload */}
        <section className="mb-6">
          <h2 className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">
            Signed payload
          </h2>
          <pre className="bg-surface rounded-xl ring-1 ring-edge p-4 text-xs font-mono text-neutral-300 overflow-x-auto">
            {JSON.stringify(
              {
                id: event?.id,
                type: event?.event_type,
                created_at: event?.created_at,
                data: event?.payload,
              },
              null,
              2,
            )}
          </pre>
        </section>

        {/* Attempt timeline */}
        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">
            Attempt history ({attempts.length})
          </h2>
          {attempts.length === 0 ? (
            <p className="text-sm text-neutral-600">No attempts recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {attempts.map((a) => (
                <div
                  key={a.id}
                  className="bg-surface rounded-xl ring-1 ring-edge p-3.5"
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`w-5 h-5 rounded grid place-items-center text-[11px] font-mono ${
                        a.ok
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-rose-500/15 text-rose-300'
                      }`}
                    >
                      {a.attempt_number}
                    </span>
                    <span className="text-sm font-medium">
                      {a.ok ? 'Delivered' : 'Failed'}
                    </span>
                    {a.status_code != null && (
                      <span className="font-mono text-xs text-neutral-400">
                        HTTP {a.status_code}
                      </span>
                    )}
                    <span className="font-mono text-xs text-neutral-600">
                      {a.duration_ms}ms
                    </span>
                    <span className="text-xs text-neutral-600 ml-auto">
                      {relativeTime(a.attempted_at)}
                    </span>
                  </div>
                  {a.error && (
                    <div className="text-xs text-rose-300/80 mt-2">{a.error}</div>
                  )}
                  {a.response_snippet && (
                    <pre className="text-[11px] font-mono text-neutral-500 mt-2 bg-ink rounded-lg p-2 overflow-x-auto">
                      {a.response_snippet}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-surface rounded-lg ring-1 ring-edge px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`text-sm mt-0.5 truncate ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </div>
    </div>
  );
}
