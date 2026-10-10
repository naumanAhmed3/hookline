import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function blockedIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) || (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) || a >= 224
  );
}

function blockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];
  return normalized === '::' || normalized === '::1' ||
    normalized.startsWith('fc') || normalized.startsWith('fd') ||
    normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
    normalized.startsWith('fea') || normalized.startsWith('feb') ||
    normalized.startsWith('ff') || normalized.startsWith('2001:db8:') ||
    normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.');
}

export async function assertSafeDestination(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only http(s) webhook destinations are allowed');
  }
  if (url.username || url.password) throw new Error('Destination credentials are not allowed');
  const allowPrivate = process.env.HOOKLINE_ALLOW_PRIVATE_DESTINATIONS === 'true';
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname, family: isIP(url.hostname) }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length) throw new Error('Destination did not resolve');
  if (!allowPrivate && addresses.some(({ address, family }) =>
    family === 4 ? blockedIpv4(address) : blockedIpv6(address))) {
    throw new Error('Private, loopback, link-local, and reserved destinations are blocked');
  }
  return url;
}

export async function safeFetch(raw: string, init: RequestInit, maxRedirects = 3): Promise<Response> {
  let url = await assertSafeDestination(raw);
  for (let i = 0; i <= maxRedirects; i++) {
    const response = await fetch(url, { ...init, redirect: 'manual' });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    if (!location) return response;
    if (i === maxRedirects) throw new Error('Too many redirects');
    url = await assertSafeDestination(new URL(location, url).toString());
  }
  throw new Error('Too many redirects');
}

export async function readSnippet(response: Response, maxBytes = 8192): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = maxBytes - total;
    const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
    chunks.push(chunk);
    total += chunk.byteLength;
    if (value.byteLength > remaining) break;
  }
  await reader.cancel().catch(() => undefined);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged).slice(0, 500);
}
