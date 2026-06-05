"use client";

/**
 * Idea section (B+D): pinned. The big æ on the RIGHT draws itself on via an
 * SVG stroke line-draw (stroke-dashoffset scrubbed), while the idea sentences
 * on the LEFT reveal one per line, stacking up - all tied to scroll.
 */

import { useRef, ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const LINES: ReactNode[] = [
  "Intelligence shouldn't sit behind five logins.",
  "Or five invoices.",
  <>
    <span className="idea-brand">æro</span> unifies every model, agent, and team.
  </>,
  "Behind a single wallet sign-in.",
];

// Generously larger than the æ glyph's outline length so it starts fully hidden.
const DASH = 3400;

export default function Manifesto() {
  const wrap = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = wrap.current;
      if (!el) return;
      const lineInners = gsap.utils.toArray<HTMLElement>(".idea-line > span", el);
      const glyph = el.querySelector<SVGTextElement>(".idea-glyph");

      gsap.set(lineInners, { yPercent: 118 });
      if (glyph) gsap.set(glyph, { strokeDasharray: DASH, strokeDashoffset: DASH });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top top", end: "+=340%", pin: true, scrub: 0.7 },
      });

      // æ starts drawing a little later, then draws across the rest of the sequence.
      if (glyph) tl.to(glyph, { strokeDashoffset: 0, ease: "none", duration: LINES.length }, 0.7);

      // a sentence reveals roughly once per unit of scroll.
      lineInners.forEach((ln, i) => {
        tl.to(ln, { yPercent: 0, ease: "power3.out", duration: 1 }, 0.5 + i);
      });

      // soft fill settles into the æ near the end.
      if (glyph) tl.to(glyph, { fillOpacity: 0.05, ease: "none", duration: 1.5 }, ">-1.5");
    },
    { scope: wrap }
  );

  return (
    <section className="idea" ref={wrap} id="idea">
      <div className="idea-inner">
        <div className="idea-lines">
          {LINES.map((line, i) => (
            <span className="idea-line" key={i}>
              <span>{line}</span>
            </span>
          ))}
        </div>

        <div className="idea-logo" aria-hidden>
          <svg viewBox="0 0 520 380" role="img">
            <text
              className="idea-glyph"
              x="260"
              y="300"
              textAnchor="middle"
              style={{ fontFamily: "var(--font-prata)", fontWeight: 400, fontSize: 360 }}
            >
              æ
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
