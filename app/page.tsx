import Link from 'next/link';
import { getStats, listDeliveries, type Stats } from '@/lib/repo';
import type { DeliveryRow, DeliveryStatus } from '@/lib/types';
import { STATUS_META, percent, relativeTime } from '@/lib/format';
import { Nav } from './nav';
import { DashboardActions } from './dashboard-actions';

export const dynamic = 'force-dynamic';

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'succeeded', label: 'Succeeded' },
  { key: 'dead', label: 'Dead-letter' },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = (sp.status as DeliveryStatus | undefined) ?? undefined;

  let stats: Stats | null = null;
  let deliveries: DeliveryRow[] = [];
  let dbError: string | null = null;
  try {
    [stats, deliveries] = await Promise.all([
      getStats(),
      listDeliveries({ status, limit: 100 }),
    ]);
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Database unavailable';
  }

  return (
    <div className="min-h-screen">
      <Nav active="overview" />
      <main className="max-w-6xl mx-auto px-6 py-6">
        {dbError ? (
          <SetupNotice error={dbError} />
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
              <div>
                <h1 className="text-lg font-semibold">Delivery overview</h1>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Every event fanned out to your endpoints, signed, retried, and audited.
                </p>
              </div>
              <DashboardActions />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label="Events" value={stats!.events} />
              <Stat label="Deliveries" value={stats!.deliveries} />
              <Stat
                label="Success rate"
                value={percent(stats!.successRate)}
                tone={stats!.successRate >= 0.9 ? 'good' : 'warn'}
              />
              <Stat label="Pending" value={stats!.pending} tone="warn" />
              <Stat label="Dead-letter" value={stats!.dead} tone={stats!.dead ? 'bad' : 'plain'} />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-1 mt-6 mb-3">
              {FILTERS.map((f) => {
                const isActive = (status ?? 'all') === f.key;
                return (
                  <Link
                    key={f.key}
                    href={f.key === 'all' ? '/' : `/?status=${f.key}`}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      isActive
                        ? 'bg-surface-2 text-white ring-1 ring-edge'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {f.label}
                  </Link>
                );
              })}
            </div>

            {/* Deliveries table */}
            <div className="bg-surface rounded-xl ring-1 ring-edge overflow-hidden">
              {deliveries.length === 0 ? (
                <div className="py-16 text-center text-sm text-neutral-600">
                  No deliveries yet. Add an endpoint, then “Send test event”.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-neutral-500 border-b border-edge-soft">
                      <th className="text-left font-medium px-4 py-2.5">Status</th>
                      <th className="text-left font-medium px-4 py-2.5">Event</th>
                      <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">
                        Endpoint
                      </th>
                      <th className="text-left font-medium px-4 py-2.5">Attempts</th>
                      <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">
                        Detail
                      </th>
                      <th className="text-left font-medium px-4 py-2.5">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => (
                      <tr
                        key={d.id}
                        className="border-b border-edge-soft last:border-0 hover:bg-surface-2 transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <StatusBadge status={d.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <Link href={`/deliveries/${d.id}`} className="hover:text-brand">
                            <span className="font-mono text-[13px]">{d.event_type}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-neutral-400 hidden md:table-cell">
                          {d.endpoint_name}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-neutral-400">
                          {d.attempt_count}/{d.max_attempts}
                        </td>
                        <td className="px-4 py-2.5 text-neutral-500 hidden lg:table-cell max-w-[240px] truncate">
                          {d.status === 'pending' && d.attempt_count > 0
                            ? `retry ${relativeTime(d.next_attempt_at)}`
                            : (d.last_error ?? '—')}
                        </td>
                        <td className="px-4 py-2.5 text-neutral-500">
                          {relativeTime(d.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'plain',
}: {
  label: string;
  value: number | string;
  tone?: 'plain' | 'good' | 'warn' | 'bad';
}) {
  const color =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'warn'
        ? 'text-amber-300'
        : tone === 'bad'
          ? 'text-rose-300'
          : 'text-white';
  return (
    <div className="bg-surface rounded-xl ring-1 ring-edge p-4">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`text-3xl font-semibold font-mono mt-1.5 ${color}`}>{value}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ring-1 ${m.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function SetupNotice({ error }: { error: string }) {
  return (
    <div className="max-w-xl mx-auto mt-12 bg-surface rounded-xl ring-1 ring-amber-500/30 p-6">
      <h2 className="font-semibold text-amber-300">Database not connected</h2>
      <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
        Hookline needs a Postgres database. Set <code className="font-mono text-neutral-300">DATABASE_URL</code>{' '}
        (a Neon connection string works well), then apply the schema:
      </p>
      <pre className="mt-3 bg-ink rounded-lg p-3 text-xs font-mono text-neutral-400 overflow-x-auto">
        node --env-file=.env.local scripts/migrate.mjs
      </pre>
      <p className="text-[11px] text-neutral-600 mt-3 font-mono">{error}</p>
    </div>
  );
}
