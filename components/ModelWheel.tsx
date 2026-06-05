"use client";

/**
 * ModelWheel - a vertical "slot wheel" of model names. The centred name is
 * fully sharp; the ones above/below are progressively blurred + dimmed. It
 * advances on its own every ROTATE_MS, and you can click any visible name (or
 * drag) to spin it there yourself. Loops endlessly; far-off names are hidden so
 * the wrap-around never flashes.
 */

import { useEffect, useRef, useState } from "react";
import type { ModelEntry } from "@/lib/models";

const ROTATE_MS = 1000; // auto-advance cadence (every 1s)
const GAP = 72; // px between stacked names
const VISIBLE = 3; // tiers shown each side of centre (rest hidden)

export default function ModelWheel({ models }: { models: ModelEntry[] }) {
  const n = models.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; base: number; moved: boolean } | null>(null);

  // auto-advance (pauses on hover / drag; respects reduced motion)
  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive((a) => (a + 1) % n), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, n]);

  // signed offset of item i from centre, wrapped to the nearest copy
  const offsetOf = (i: number) => {
    let off = i - active;
    if (off > n / 2) off -= n;
    if (off < -n / 2) off += n;
    return off;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, base: active, moved: false };
    setPaused(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const steps = Math.round((d.y - e.clientY) / GAP);
    if (steps !== 0) {
      d.moved = true;
      setActive(((d.base + steps) % n + n) % n);
    }
  };
  const endDrag = () => {
    drag.current = null;
    setPaused(false);
  };

  const step = (dir: number) => setActive((a) => ((a + dir) % n + n) % n);

  return (
    <div
      className="wheel"
      ref={wrap}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <button type="button" className="wheel-arrow wheel-arrow-up" onClick={() => step(-1)} aria-label="Previous model">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 15 12 9 18 15" />
        </svg>
      </button>

      <span className="wheel-guide" aria-hidden />
      <div className="wheel-mask">
        {models.map((m, i) => {
          const off = offsetOf(i);
          const abs = Math.abs(off);
          const hidden = abs > VISIBLE;
          // The active row shows name + provider beneath it. Lift the name a touch
          // so the name+provider pair is centred between the guide lines, not just
          // the name (provider would otherwise make the pair bottom-heavy).
          const activeNudge = off === 0 ? -12 : 0;
          // main = sharp; each tier out is dimmer + more blurred (a little → more
          // → even more).
          const opacity = hidden ? 0 : abs === 0 ? 1 : abs === 1 ? 0.5 : abs === 2 ? 0.2 : 0.07;
          const blur = abs === 0 ? 0 : abs === 1 ? 2 : abs === 2 ? 4 : 6.5;
          return (
            <button
              key={m.name}
              type="button"
              className={`wheel-item ${off === 0 ? "is-active" : ""}`}
              style={{
                transform: `translate(-50%, calc(-50% + ${off * GAP + activeNudge}px)) scale(${1 - abs * 0.1})`,
                opacity,
                filter: `blur(${blur}px)`,
                pointerEvents: hidden ? "none" : "auto",
              }}
              tabIndex={hidden ? -1 : 0}
              onClick={() => {
                if (!drag.current?.moved) setActive(i);
              }}
            >
              {m.name}
            </button>
          );
        })}
      </div>

      <span key={active} className="wheel-provider" aria-live="polite">
        {models[active].provider}
      </span>

      <button type="button" className="wheel-arrow wheel-arrow-down" onClick={() => step(1)} aria-label="Next model">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  );
}
