// Applies lib/schema.sql to the database in DATABASE_URL.
// Run with: node --env-file=.env.local scripts/migrate.mjs
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(url, { ssl: 'require' });
const schema = readFileSync(new URL('../lib/schema.sql', import.meta.url), 'utf8');

try {
  await sql.unsafe(schema);
  console.log('✓ schema applied');
} catch (err) {
  console.error('migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
