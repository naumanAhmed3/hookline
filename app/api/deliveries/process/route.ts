import { NextResponse } from 'next/server';
import { drainQueue } from '@/lib/worker';
import { authError, requireCronOrAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Drains the delivery queue once: reclaims orphaned rows, claims due
// deliveries, attempts them. Called both by the Vercel Cron schedule
// (GET, the retry backstop) and the dashboard "Process now" button (POST).
async function handle(req: Request) {
  try {
    requireCronOrAdmin(req);
    const result = await drainQueue();
    return NextResponse.json(result);
  } catch (e) {
    const auth = authError(e);
    if (auth) return auth;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'drain failed' },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
