import Link from 'next/link';

export function Nav({ active }: { active: 'overview' | 'endpoints' }) {
  return (
    <header className="border-b border-edge-soft sticky top-0 z-30 bg-ink/95 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 h-15 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-brand/15 ring-1 ring-brand/30">
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-brand" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h9a4 4 0 0 1 4 4v6" />
                <path d="m13 13 4 4 4-4" />
              </svg>
            </span>
            <span className="font-semibold tracking-tight">Hookline</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/"
              className={`px-2.5 py-1 rounded-md ${
                active === 'overview'
                  ? 'text-white bg-surface-2'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Overview
            </Link>
            <Link
              href="/endpoints"
              className={`px-2.5 py-1 rounded-md ${
                active === 'endpoints'
                  ? 'text-white bg-surface-2'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Endpoints
            </Link>
          </nav>
        </div>
        <span className="text-[11px] font-mono text-neutral-600 hidden sm:block">
          webhook delivery gateway
        </span>
      </div>
    </header>
  );
}
