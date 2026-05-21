'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

const SAMPLE_EVENTS = [
  { event_type: 'order.created', payload: { order_id: 'ord_4821', total: 6400, currency: 'usd' } },
  { event_type: 'user.signed_up', payload: { user_id: 'usr_9d2', plan: 'pro' } },
  { event_type: 'invoice.paid', payload: { invoice_id: 'in_77c', amount: 12000 } },
  { event_type: 'subscription.canceled', payload: { sub_id: 'sub_3a1', reason: 'downgrade' } },
];

export function DashboardActions() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const sendTestEvent = async () => {
    setBusy('send');
    try {
      const sample = SAMPLE_EVENTS[Math.floor(Math.random() * SAMPLE_EVENTS.length)];
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sample),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Ingest failed');
      flash(
        data.deliveries === 0
          ? `Sent "${sample.event_type}" — no enabled endpoints yet`
          : `Sent "${sample.event_type}" → ${data.deliveries} delivery(s) dispatched`,
      );
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setBusy(null);
      startTransition(() => router.refresh());
    }
  };

  const processQueue = async () => {
    setBusy('process');
    try {
      const res = await fetch('/api/deliveries/process', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || 'Drain failed');
      flash(
        `Queue drained — ${d.claimed} claimed · ${d.succeeded} ok · ${d.retried} retrying · ${d.dead} dead`,
      );
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed to drain');
    } finally {
      setBusy(null);
      startTransition(() => router.refresh());
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={sendTestEvent}
        disabled={busy !== null}
        className="px-3 h-9 rounded-lg bg-brand text-ink text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 transition-colors"
      >
        {busy === 'send' ? 'Sending…' : 'Send test event'}
      </button>
      <button
        onClick={processQueue}
        disabled={busy !== null}
        className="px-3 h-9 rounded-lg bg-surface ring-1 ring-edge text-sm hover:bg-surface-2 disabled:opacity-50 transition-colors"
      >
        {busy === 'process' ? 'Draining…' : 'Process queue now'}
      </button>
      {(toast || pending) && (
        <span className="text-xs text-neutral-400 hl-fade">{toast ?? 'Refreshing…'}</span>
      )}
    </div>
  );
}
