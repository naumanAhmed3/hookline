import { NextResponse } from 'next/server';
import { deleteEndpoint, setEndpointEnabled } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/endpoints/:id — toggle enabled.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const enabled = (body as Record<string, unknown>)?.enabled;
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: '`enabled` must be a boolean' }, { status: 400 });
  }
  await setEndpointEnabled(id, enabled);
  return NextResponse.json({ id, enabled });
}

// DELETE /api/endpoints/:id
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteEndpoint(id);
  return NextResponse.json({ deleted: id });
}
