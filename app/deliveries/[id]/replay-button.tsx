'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ReplayButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const replay = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/deliveries/${id}/replay`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Replay failed');
      }
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Replay failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={replay}
      disabled={busy}
      className="px-3 h-9 rounded-lg bg-brand text-ink text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 transition-colors"
    >
      {busy ? 'Replaying…' : 'Replay delivery'}
    </button>
  );
}
