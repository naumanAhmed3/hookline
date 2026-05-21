import type { DeliveryStatus } from './types';

export function relativeTime(iso: string | number | Date): string {
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  const abs = Math.abs(diff);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  const fmt = (n: number, u: string) => `${n}${u}`;
  let s: string;
  if (abs < min) s = 'just now';
  else if (abs < hour) s = fmt(Math.round(abs / min), 'm');
  else if (abs < day) s = fmt(Math.round(abs / hour), 'h');
  else s = fmt(Math.round(abs / day), 'd');
  if (s === 'just now') return s;
  return diff >= 0 ? `${s} ago` : `in ${s}`;
}

export const STATUS_META: Record<
  DeliveryStatus,
  { label: string; cls: string; dot: string }
> = {
  pending: {
    label: 'Pending',
    cls: 'text-amber-300 bg-amber-500/10 ring-amber-500/30',
    dot: 'bg-amber-400',
  },
  delivering: {
    label: 'Delivering',
    cls: 'text-sky-300 bg-sky-500/10 ring-sky-500/30',
    dot: 'bg-sky-400',
  },
  succeeded: {
    label: 'Succeeded',
    cls: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  failed: {
    label: 'Failed',
    cls: 'text-rose-300 bg-rose-500/10 ring-rose-500/30',
    dot: 'bg-rose-400',
  },
  dead: {
    label: 'Dead-letter',
    cls: 'text-rose-300 bg-rose-500/10 ring-rose-500/30',
    dot: 'bg-rose-400',
  },
};

export function percent(n: number): string {
  return `${Math.round(n * 100)}%`;
}
