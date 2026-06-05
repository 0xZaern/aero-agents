"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MODELS, PROVIDERS } from "@/lib/models";

// three.js mesh deferred to its own chunk so it never blocks the stats counters.
const CtaMesh = dynamic(() => import("./CtaMesh"), { ssr: false });

// Model + provider counts derive from lib/models.ts (single source of truth) so
// they stay correct when the lineup changes. Agents/credits stay fixed.
const STATS = [
  { target: MODELS.length, suffix: "", label: "frontier models" },
  { target: PROVIDERS.length, suffix: "", label: "providers" },
  { target: 13, suffix: "", label: "preset agents" },
  { target: 1, prefix: "$", suffix: "", label: "free credits" },
];

function Counter({ target, prefix = "", suffix = "" }: { target: number; prefix?: string; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done.current) {
        done.current = true;
        const dur = 1100;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(Math.round(target * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="stat-num">
      {prefix}
      {val}
      {suffix}
    </span>
  );
}

export default function Stats() {
  return (
    <section className="stats">
      <CtaMesh className="stats-mesh" maxOpacity={0.32} speed={0.4} />
      <div className="container">
        <div className="stats-grid">
          {STATS.map((s) => (
            <div key={s.label} className="stat">
              <Counter target={s.target} prefix={s.prefix} suffix={s.suffix} />
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
