import { NextResponse } from 'next/server';
import { drainQueue } from '@/lib/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Drains the delivery queue once: reclaims orphaned rows, claims due
// deliveries, attempts them. Called both by the Vercel Cron schedule
// (GET, the retry backstop) and the dashboard "Process now" button (POST).
async function handle() {
  try {
    const result = await drainQueue();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'drain failed' },
      { status: 500 },
    );
  }
}

export async function GET() {
  return handle();
}

export async function POST() {
  return handle();
}
