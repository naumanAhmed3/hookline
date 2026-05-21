import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────
// A configurable mock webhook receiver — point Hookline endpoints
// here to demonstrate success, retries, and the dead-letter queue
// without needing an external service.
//
//   /api/sink?behavior=ok          always 200
//   /api/sink?behavior=fail        always 500
//   /api/sink?behavior=flaky       ~50% 200, ~50% 503
//   /api/sink?behavior=slow        delays ~3s, then 200
//   /api/sink?behavior=ratelimited always 429
// ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const behavior = new URL(req.url).searchParams.get('behavior') ?? 'ok';
  await req.text().catch(() => ''); // drain the body

  switch (behavior) {
    case 'fail':
      return NextResponse.json({ received: false, behavior }, { status: 500 });
    case 'ratelimited':
      return NextResponse.json(
        { received: false, behavior },
        { status: 429, headers: { 'retry-after': '30' } },
      );
    case 'flaky':
      return Math.random() < 0.5
        ? NextResponse.json({ received: true, behavior }, { status: 200 })
        : NextResponse.json({ received: false, behavior }, { status: 503 });
    case 'slow':
      await new Promise((r) => setTimeout(r, 3000));
      return NextResponse.json({ received: true, behavior, delayed_ms: 3000 });
    case 'ok':
    default:
      return NextResponse.json({ received: true, behavior: 'ok' }, { status: 200 });
  }
}
