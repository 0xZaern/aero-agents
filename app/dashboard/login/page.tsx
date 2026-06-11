'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The old full-page login is gone. Hitting the dashboard while logged out (or
// logging out) sends you back to the landing. The connect modal only opens when
// the user explicitly clicks "Launch App" - it's never forced on the landing.
export default function LoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="term" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div className="mono" style={{ color: 'var(--t-dim)', fontSize: 13 }}>
        aero returning home…<span className="term-caret" />
      </div>
    </div>
  );
}
