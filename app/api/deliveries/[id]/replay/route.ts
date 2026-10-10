import { NextResponse } from 'next/server';
import { drainQueue, requeueDelivery } from '@/lib/worker';
import { authError, requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/deliveries/:id/replay — re-queue a settled (or dead)
// delivery from a clean slate, then attempt it immediately.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try { requireAdmin(req); } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const requeued = await requeueDelivery(id);
  if (!requeued) {
    return NextResponse.json(
      { error: 'Delivery not found, or not in a replayable state' },
      { status: 404 },
    );
  }
  const drain = await drainQueue();
  return NextResponse.json({ replayed: id, drain });
}
