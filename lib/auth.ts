import { createHash, timingSafeEqual } from 'node:crypto';

function equal(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}

function requireBearer(req: Request, expected: string | undefined): void {
  if (!expected) throw new Error('AUTH_NOT_CONFIGURED');
  const supplied = req.headers.get('authorization') ?? '';
  if (!supplied.startsWith('Bearer ') || !equal(supplied.slice(7), expected)) {
    throw new Error('UNAUTHORIZED');
  }
}

export const requireAdmin = (req: Request): void =>
  requireBearer(req, process.env.HOOKLINE_ADMIN_TOKEN);

export const requireIngest = (req: Request): void =>
  requireBearer(req, process.env.HOOKLINE_INGEST_TOKEN);

export function requireCronOrAdmin(req: Request): void {
  const supplied = req.headers.get('authorization') ?? '';
  const candidates = [process.env.CRON_SECRET, process.env.HOOKLINE_ADMIN_TOKEN].filter(
    (value): value is string => Boolean(value),
  );
  if (!candidates.length) throw new Error('AUTH_NOT_CONFIGURED');
  if (!supplied.startsWith('Bearer ') || !candidates.some((value) => equal(supplied.slice(7), value))) {
    throw new Error('UNAUTHORIZED');
  }
}

export function authError(error: unknown): Response | null {
  if (!(error instanceof Error)) return null;
  if (error.message === 'UNAUTHORIZED') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (error.message === 'AUTH_NOT_CONFIGURED') {
    return Response.json({ error: 'Authentication is not configured' }, { status: 503 });
  }
  return null;
}
