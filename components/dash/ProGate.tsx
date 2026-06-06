'use client';

import Link from 'next/link';
import { useAuthStore } from '@/lib/dash/stores/authStore';

const PERKS = [
  'unlock agents, teams & the scheduler',
  '50% off every model you use',
  '$20 in credits included',
];

// Wraps PRO-only areas. Basic-plan users see a lock panel with an upgrade CTA;
// PRO users see the children unchanged.
export default function ProGate({ feature, children }: { feature: string; children?: React.ReactNode }) {
  const isPro = useAuthStore((s) => s.isPro());
  if (isPro) return <>{children}</>;

  return (
    <div className="term-scroll" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="term-panel" style={{ width: 460, maxWidth: '94vw' }}>
        <div className="term-panel-head">
          pro feature
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 15, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden>🔒</span> {feature}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Available on the PRO plan. Upgrade to unlock {feature.toLowerCase()}.
          </div>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none', margin: 0, padding: 0 }}>
            {PERKS.map((p) => (
              <li key={p} style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--t-accent)', marginRight: 8 }}>›</span>{p}
              </li>
            ))}
          </ul>
          <Link href="/dashboard/billing" className="term-btn primary" style={{ width: 'fit-content' }}>
            upgrade to pro
          </Link>
        </div>
      </div>
    </div>
  );
}
