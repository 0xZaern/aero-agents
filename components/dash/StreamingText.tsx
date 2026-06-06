'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Smooth typewriter for streaming output. Decouples what's shown from the
 * network: tokens arrive in bursts, but we reveal characters at a steady,
 * self-catching-up rate so the text types out smoothly (no jumping/lag).
 * Rendered as plain text for cheap re-renders; the final message renders
 * full markdown once streaming completes.
 */
export default function StreamingText({ text }: { text: string }) {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const tick = () => {
      if (cancelled) return;
      const target = textRef.current.length;
      let cur = shownRef.current;
      if (cur > target) cur = 0; // a new (shorter) message started - reset
      if (cur < target) {
        // reveal faster when far behind, ease out near the end → smooth
        const step = Math.max(1, Math.ceil((target - cur) / 8));
        cur = Math.min(target, cur + step);
        shownRef.current = cur;
        setShown(cur);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, []);

  return (
    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {text.slice(0, shown)}
      <span className="term-caret" />
    </span>
  );
}
