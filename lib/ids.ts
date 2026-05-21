import { randomUUID } from 'node:crypto';

/** Prefixed, sortable-enough identifiers — easy to eyeball in logs. */
export function newId(prefix: 'ep' | 'evt' | 'del' | 'att'): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}
