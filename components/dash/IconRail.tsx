'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/dash/stores/authStore';

function Ic({ d, s = 18 }: { d: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const NAV = [
  { href: '/dashboard/chat', label: 'chat', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { href: '/dashboard/agents', label: 'agents', icon: 'M12 8V4H8|M4 12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z|M2 14h2|M20 14h2|M15 13v2|M9 13v2' },
  { href: '/dashboard/teams', label: 'teams', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 7a4 4 0 1 0 0 0|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75' },
  { href: '/dashboard/scheduler', label: 'scheduler', icon: 'M12 6v6l4 2|M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20' },
  { href: '/dashboard/costs', label: 'costs', icon: 'M12 1v22|M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  { href: '/dashboard/billing', label: 'billing', icon: 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z|M2 10h20' },
  { href: '/dashboard/api', label: 'developer API', icon: 'M16 18l6-6-6-6|M8 6l-6 6 6 6' },
  { href: '/dashboard/settings', label: 'settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
];

export default function IconRail() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  return (
    <>
      <Link href="/dashboard/chat" className="term-rail-logo" title="aero" aria-label="aero">
        <span style={{ fontFamily: 'var(--font-prata)', fontSize: '1.5rem', lineHeight: 1, color: 'var(--t-text)' }}>æ</span>
      </Link>

      <nav className="term-rail-nav">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/');
          return (
            <Link key={n.href} href={n.href} className={`term-rail-item${active ? ' active' : ''}`} title={n.label} aria-label={n.label}>
              <Ic d={n.icon} />
            </Link>
          );
        })}
      </nav>

      <div className="term-rail-foot">
        <button
          className="term-rail-item"
          title="logout"
          aria-label="logout"
          onClick={() => { logout(); router.replace('/'); }}
        >
          <Ic d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9" s={17} />
        </button>
      </div>
    </>
  );
}
