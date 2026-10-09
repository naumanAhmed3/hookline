import { NextResponse } from 'next/server';
import { createEndpoint, listEndpoints } from '@/lib/repo';
import { authError, requireAdmin } from '@/lib/auth';
import { assertSafeDestination } from '@/lib/safe-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const endpoints = await listEndpoints();
    return NextResponse.json(endpoints.map(({ secret: _secret, ...endpoint }) => endpoint));
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST /api/endpoints — register a webhook destination.
export async function POST(req: Request) {
  try {
    requireAdmin(req);
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }
  const obj = body as Record<string, unknown>;
  const name = typeof obj?.name === 'string' ? obj.name.trim() : '';
  const url = typeof obj?.url === 'string' ? obj.url.trim() : '';

  if (!name) return NextResponse.json({ error: '`name` is required' }, { status: 400 });
  try {
    await assertSafeDestination(url);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid destination URL' },
      { status: 400 },
    );
  }

  const endpoint = await createEndpoint(name, url);
  return NextResponse.json(endpoint, { status: 201 });
}
