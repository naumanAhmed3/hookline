import type { Metadata } from 'next';
import { Nav } from '../nav';
import { EndpointManager } from './endpoint-manager';

export const metadata: Metadata = { title: 'Endpoints — Hookline' };

export default function EndpointsPage() {
  return (
    <div className="min-h-screen">
      <Nav active="endpoints" />
      <main className="max-w-6xl mx-auto px-6 py-6">
        <EndpointManager />
      </main>
    </div>
  );
}
