'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Endpoint } from '@/lib/types';

const PRESETS = [
  { label: 'Reliable receiver', behavior: 'ok', hint: 'always 200' },
  { label: 'Flaky receiver', behavior: 'flaky', hint: '~50% fail → watch retries' },
  { label: 'Always fails', behavior: 'fail', hint: '500 → lands in the dead-letter queue' },
  { label: 'Slow receiver', behavior: 'slow', hint: '~3s response' },
];

export function EndpointManager() {
  const [endpoints, setEndpoints] = useState<Endpoint[] | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/endpoints');
      if (!res.ok) throw new Error('Could not load endpoints');
      setEndpoints(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
      setEndpoints([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const usePreset = (behavior: string, label: string) => {
    setName(label);
    setUrl(`${window.location.origin}/api/sink?behavior=${behavior}`);
  };

  const create = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/endpoints', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not create endpoint');
      setName('');
      setUrl('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (ep: Endpoint) => {
    await fetch(`/api/endpoints/${ep.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !ep.enabled }),
    });
    await load();
  };

  const remove = async (ep: Endpoint) => {
    if (!confirm(`Delete endpoint "${ep.name}"? Its deliveries are removed too.`)) return;
    await fetch(`/api/endpoints/${ep.id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      {/* List */}
      <div>
        <h1 className="text-lg font-semibold mb-1">Endpoints</h1>
        <p className="text-sm text-neutral-500 mb-4">
          Every event fans out to each enabled endpoint. Each gets its own signing secret.
        </p>
        <div className="bg-surface rounded-xl ring-1 ring-edge overflow-hidden">
          {endpoints === null ? (
            <div className="py-12 text-center text-sm text-neutral-600">Loading…</div>
          ) : endpoints.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-600">
              No endpoints yet. Add one with a preset on the right.
            </div>
          ) : (
            endpoints.map((ep) => (
              <div
                key={ep.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-edge-soft last:border-0"
              >
                <button
                  onClick={() => toggle(ep)}
                  title={ep.enabled ? 'Enabled — click to pause' : 'Paused — click to enable'}
                  className={`w-9 h-5 rounded-full shrink-0 transition-colors ${
                    ep.enabled ? 'bg-brand' : 'bg-edge'
                  } relative`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                      ep.enabled ? 'left-4' : 'left-0.5'
                    }`}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{ep.name}</div>
                  <div className="text-[11px] text-neutral-500 font-mono truncate">{ep.url}</div>
                  <div className="text-[10px] text-neutral-600 font-mono mt-0.5">
                    {ep.secret.slice(0, 14)}…
                  </div>
                </div>
                <button
                  onClick={() => remove(ep)}
                  className="text-xs text-neutral-500 hover:text-rose-300 shrink-0"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add form */}
      <div className="bg-surface rounded-xl ring-1 ring-edge p-4 h-fit">
        <h2 className="text-sm font-semibold mb-3">Add an endpoint</h2>
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full h-9 px-3 rounded-lg bg-ink ring-1 ring-edge text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-brand/40"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full h-9 px-3 rounded-lg bg-ink ring-1 ring-edge text-sm font-mono placeholder:text-neutral-600 focus:outline-none focus:ring-brand/40"
          />
          <button
            onClick={create}
            disabled={busy || !name || !url}
            className="w-full h-9 rounded-lg bg-brand text-ink text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 transition-colors"
          >
            {busy ? 'Adding…' : 'Add endpoint'}
          </button>
          {error && <p className="text-xs text-rose-300">{error}</p>}
        </div>

        <div className="mt-4 pt-4 border-t border-edge-soft">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">
            Quick presets — built-in test receiver
          </div>
          <div className="space-y-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.behavior}
                onClick={() => usePreset(p.behavior, p.label)}
                className="w-full text-left px-3 py-2 rounded-lg bg-ink ring-1 ring-edge-soft hover:ring-edge transition-all"
              >
                <div className="text-xs font-medium">{p.label}</div>
                <div className="text-[10px] text-neutral-500">{p.hint}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
