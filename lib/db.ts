import postgres, { type Sql } from 'postgres';

// ─────────────────────────────────────────────────────────────
// Lazy Postgres connection. Lazy so `next build` can import route
// modules without a live DATABASE_URL.
// ─────────────────────────────────────────────────────────────

let _sql: Sql | null = null;

export function db(): Sql {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    _sql = postgres(url, {
      ssl: 'require',
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  }
  return _sql;
}
