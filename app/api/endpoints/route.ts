import { NextResponse } from 'next/server';
import { createEndpoint, listEndpoints } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await listEndpoints());
}

// POST /api/endpoints — register a webhook destination.
export async function POST(req: Request) {
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
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('bad protocol');
    }
  } catch {
    return NextResponse.json({ error: '`url` must be a valid http(s) URL' }, { status: 400 });
  }

  const endpoint = await createEndpoint(name, url);
  return NextResponse.json(endpoint, { status: 201 });
}
