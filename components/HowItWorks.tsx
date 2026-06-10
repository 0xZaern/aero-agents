"use client";

/**
 * HowItWorks - pinned. Opens on a big "How it works" title. On scroll the camera
 * starts PULLED BACK over the 2x2 grid, then dollies IN - zooming through the
 * title onto step 1 (top-left) at 1:1. From there it pans step by step
 * (TL → TR → BR → BL); each step fades in as the camera lands, out as it leaves.
 * Scrubbed + slow so the descent reads as a real camera push, not a cut.
 *
 * A white tracer threads through the boxes: a connector line reaches a box, then
 * TWO strokes grow from that touch point in opposite directions and meet on the
 * far edge (covering the whole border); the next connector departs from the
 * meeting point. box01 → line → box02 → line → box03 → line → box04. All <path>s
 * are built at runtime from the boxes' measured positions (so they land exactly
 * on the borders) and drawn via stroke-dashoffset, sliced across the timeline so
 * the line advances in step with the camera.
 */

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MODEL_COUNT } from "@/lib/models";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STEPS = [
  { n: "01", id: "signin", title: "Sign in", body: "Connect your wallet. No email, no signup, no password to forget. Your wallet is your account.", pos: { gridColumn: 1, gridRow: 1 } },
  { n: "02", id: "pick", title: "Pick", body: `Choose a model, an agent, or a whole team. ${MODEL_COUNT} frontier models, 13 presets, infinite custom. Switch any time.`, pos: { gridColumn: 2, gridRow: 1 } },
  { n: "03", id: "chat", title: "Chat", body: "Ask anything. Run tasks. Watch agents search the web, read URLs and run code, streaming token by token.", pos: { gridColumn: 2, gridRow: 2 } },
  { n: "04", id: "track", title: "Track", body: "See exactly what every request costs: per message, per model, per day. No subscriptions, no surprises.", pos: { gridColumn: 1, gridRow: 2 } },
];

function StepVisual({ id }: { id: string }) {
  if (id === "signin")
    return (
      <div className="hiw-vis">
        <span className="hiw-chip hiw-chip-accent">Connect Wallet</span>
        <span className="hiw-chip">0xA1b…9F4c</span>
      </div>
    );
  if (id === "pick")
    return (
      <div className="hiw-vis hiw-list">
        {["Claude Opus", "GPT-5.4", "Gemini 3", "Grok 4"].map((m, i) => (
          <span key={m} className={`hiw-row ${i === 0 ? "on" : ""}`}>
            {m}
          </span>
        ))}
      </div>
    );
  if (id === "chat")
    return (
      <div className="hiw-vis hiw-chat">
        <span className="hiw-msg hiw-msg-q">Summarize this paper</span>
        <span className="hiw-msg hiw-msg-a">
          Here are the key findings
          <i className="hiw-caret" />
        </span>
      </div>
    );
  // track
  return (
    <div className="hiw-vis hiw-track">
      <div className="hiw-bars">
        {[40, 72, 54, 90, 63].map((h, i) => (
          <i key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
      <span className="hiw-cost">
        $0.0042
        <em>this message</em>
      </span>
    </div>
  );
}

// Camera target per step - translate as % of the 200% stage, at scale 1.
// transform-origin is the stage's top-left (0 0), so at scale 1 these are pure
// pans that frame one 100vw×100vh quadrant each.
const CAM = [
  { x: 0, y: 0 },     // 01 - top left
  { x: -50, y: 0 },   // 02 - top right
  { x: -50, y: -50 }, // 03 - bottom right
  { x: 0, y: -50 },   // 04 - bottom left
];

// Opening framing: stage at half scale, anchored top-left (origin 0 0), so the
// whole 200%×200% grid shrinks to exactly fill the viewport - all four steps
// visible at once, laid out 2×2. Scaling back up to 1 (translate 0) then dives
// into the top-left quadrant (step 1); CAM[i] pans to the rest at scale 1.
const GRID_SCALE = 0.5;
const FAINT = 0.18; // resting opacity of the steps we're not focused on

export default function HowItWorks() {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const el = wrap.current, st = stage.current;
      if (!el || !st) return;
      // The entire 2x2 camera-pan choreography is desktop-only — its layout is
      // built from GSAP transforms (a 200vw stage), which is meaningless on a
      // phone. Below 768px we skip it all and the steps render as a static
      // vertical stack (see the `.how` mobile CSS).
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
      const cells = gsap.utils.toArray<HTMLElement>(".how-cell", el);

      // ── Build the tracer geometry (stage-local pixels). ───────────────────
      // Each box is hugged by TWO strokes that begin where the connector touches
      // it (the "start" edge) and grow in opposite directions, meeting at the
      // "end" edge - so the whole border gets covered. The next connector then
      // departs from that meeting point. cells order is TL,TR,BR,BL.
      type Rect = { x: number; y: number; w: number; h: number };
      type Edge = "top" | "right" | "bottom" | "left";
      const R = 26; // matches .how-cell-inner border-radius
      const rectOf = (cell: HTMLElement): Rect => {
        const inner = cell.querySelector<HTMLElement>(".how-cell-inner")!;
        return {
          x: cell.offsetLeft + inner.offsetLeft,
          y: cell.offsetTop + inner.offsetTop,
          w: inner.offsetWidth,
          h: inner.offsetHeight,
        };
      };
      // Each quarter goes from one edge-mid to the next, rounding the corner
      // between them. `cw` quarters are keyed by the edge they START at and turn
      // clockwise (sweep 1); `ccw` quarters turn counter-clockwise (sweep 0).
      const geom = (b: Rect) => {
        const xr = b.x + b.w, yb = b.y + b.h, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        return {
          pt: { top: [cx, b.y], right: [xr, cy], bottom: [cx, yb], left: [b.x, cy] } as Record<Edge, number[]>,
          cw: {
            top: `L ${xr - R} ${b.y} A ${R} ${R} 0 0 1 ${xr} ${b.y + R} L ${xr} ${cy} `,
            right: `L ${xr} ${yb - R} A ${R} ${R} 0 0 1 ${xr - R} ${yb} L ${cx} ${yb} `,
            bottom: `L ${b.x + R} ${yb} A ${R} ${R} 0 0 1 ${b.x} ${yb - R} L ${b.x} ${cy} `,
            left: `L ${b.x} ${b.y + R} A ${R} ${R} 0 0 1 ${b.x + R} ${b.y} L ${cx} ${b.y} `,
          } as Record<Edge, string>,
          ccw: {
            top: `L ${b.x + R} ${b.y} A ${R} ${R} 0 0 0 ${b.x} ${b.y + R} L ${b.x} ${cy} `,
            left: `L ${b.x} ${yb - R} A ${R} ${R} 0 0 0 ${b.x + R} ${yb} L ${cx} ${yb} `,
            bottom: `L ${xr - R} ${yb} A ${R} ${R} 0 0 0 ${xr} ${yb - R} L ${xr} ${cy} `,
            right: `L ${xr} ${b.y + R} A ${R} ${R} 0 0 0 ${xr - R} ${b.y} L ${cx} ${b.y} `,
          } as Record<Edge, string>,
        };
      };
      const CW: Edge[] = ["top", "right", "bottom", "left"];
      const CCW: Edge[] = ["top", "left", "bottom", "right"];
      const walk = (q: Record<Edge, string>, order: Edge[], start: Edge, end: Edge) => {
        let n = ((order.indexOf(end) - order.indexOf(start)) % 4 + 4) % 4;
        if (n === 0) n = 4; // full loop
        let out = "", cur = start;
        for (let k = 0; k < n; k++) {
          out += q[cur];
          cur = order[(order.indexOf(cur) + 1) % 4];
        }
        return out;
      };
      // two paths (cw + ccw) that both start at `start` and meet at `end`
      const hugPaths = (b: Rect, start: Edge, end: Edge) => {
        const g = geom(b);
        const [sx, sy] = g.pt[start];
        return [
          `M ${sx} ${sy} ` + walk(g.cw, CW, start, end),
          `M ${sx} ${sy} ` + walk(g.ccw, CCW, start, end),
        ];
      };
      const connector = (from: Rect, fe: Edge, to: Rect, te: Edge) => {
        const a = geom(from).pt[fe], c = geom(to).pt[te];
        return `M ${a[0]} ${a[1]} L ${c[0]} ${c[1]} `;
      };

      const boxes = cells.map(rectOf);
      // start edge = where the incoming connector touches; end edge = where it
      // exits toward the next box (chosen so connectors stay orthogonal).
      const HUG: { b: Rect; start: Edge; end: Edge }[] = [
        { b: boxes[0], start: "left", end: "right" },   // 01 (no incoming) → exit right
        { b: boxes[1], start: "left", end: "bottom" },  // 02 enter left → exit bottom
        { b: boxes[2], start: "top", end: "left" },     // 03 enter top → exit left
        { b: boxes[3], start: "right", end: "left" },   // 04 enter right (final)
      ];
      const LINKS = [
        connector(boxes[0], "right", boxes[1], "left"),   // 01 → 02
        connector(boxes[1], "bottom", boxes[2], "top"),   // 02 → 03
        connector(boxes[2], "left", boxes[3], "right"),   // 03 → 04
      ];

      const svgEl = svg.current!;
      svgEl.setAttribute("viewBox", `0 0 ${st.offsetWidth} ${st.offsetHeight}`);
      svgEl.innerHTML = ""; // clear any paths from a previous (hot-reload) run
      // create a hidden (dash pushed fully off) <path> for a piece of geometry
      const mkPath = (d: string) => {
        const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        p.setAttribute("class", "how-tracer-path");
        p.setAttribute("d", d);
        svgEl.appendChild(p);
        const len = p.getTotalLength();
        // One dash the length of the path + an oversized gap (so the dash can't
        // repeat/wrap onto the path), offset a few px past the start so the round
        // cap sits off-path while hidden - no stray dot or tick at the corners.
        gsap.set(p, { strokeDasharray: `${len} ${len + 100}`, strokeDashoffset: len + 8 });
        return p;
      };
      const hugEls = HUG.map((h) => hugPaths(h.b, h.start, h.end).map(mkPath)); // [[cw,ccw], …]
      const linkEls = LINKS.map(mkPath);

      // In the pulled-back grid the columns otherwise sit far apart; nudge each
      // column toward the centre vertical line so the four faint steps read as a
      // tighter cluster. Cleared to 0 (centred) whenever a step is focused, so
      // the 1:1 views stay centred. Left column = steps 01 & 04, right = 02 & 03.
      const shiftFor = (i: number) => (i === 0 || i === 3 ? 11 : -11);

      // Stage opens pulled back to show the whole 2×2 grid; origin top-left so
      // scaling up dives toward the step-1 quadrant.
      gsap.set(st, { transformOrigin: "0% 0%", scale: GRID_SCALE, xPercent: 0, yPercent: 0 });
      gsap.set(cells, { autoAlpha: 0, scale: 1, xPercent: (i: number) => shiftFor(i) });
      gsap.set(heading.current, { autoAlpha: 1, scale: 1 });
      // (tracer paths are created already hidden inside mkPath)

      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top top", end: "+=680%", pin: true, scrub: 1 },
      });

      // ── 1) Title flies out; the full 4-step grid fades up FAINT behind it. ──
      // So when the title clears, you see all four steps laid out 2×2 at low
      // opacity - a map of where the camera is about to go.
      tl.to(heading.current, { scale: 4.5, autoAlpha: 0, ease: "power1.in", duration: 1.6 }, 0);
      tl.to(cells, { autoAlpha: FAINT, ease: "power1.out", duration: 1.4 }, 0.5);
      tl.to({}, { duration: 0.6 }); // hold on the faint grid

      // ── 2) Dive into each step one by one. ────────────────────────────────
      // The camera zooms/pans to a quadrant and that step brightens to full;
      // the others sink back to faint. Step 1 is reached by scaling 0.5 → 1.
      tl.to(st, { scale: 1, xPercent: CAM[0].x, yPercent: CAM[0].y, ease: "power1.inOut", duration: 2.4 }, ">");
      // As we dive in, slide EVERY step back to centred (xPercent 0). After this
      // we stay at scale 1, so keeping them all centred means the step-to-step
      // pans travel in straight lines - 03 drops straight down under 02 instead
      // of drifting in diagonally.
      tl.to(cells, { xPercent: 0, ease: "power1.inOut", duration: 2.4 }, "<");
      tl.to(cells[0], { autoAlpha: 1, ease: "power1.inOut", duration: 2.4 }, "<");
      // Hug box 01 only AFTER the camera has landed. During the dive the cells
      // are still sliding from their pulled-back offset to centre (xPercent→0),
      // so drawing earlier would trace a box that hasn't settled into place yet.
      // Both strokes grow together from the start edge and meet at the exit.
      tl.to(hugEls[0], { strokeDashoffset: 0, ease: "power2.out", duration: 1.4 }, ">");
      tl.to({}, { duration: 0.7 }); // dwell

      for (let i = 1; i < CAM.length; i++) {
        tl.to(cells[i - 1], { autoAlpha: FAINT, ease: "power1.in", duration: 0.9 });
        tl.to(st, { xPercent: CAM[i].x, yPercent: CAM[i].y, ease: "power1.inOut", duration: 1.6 }, "<");
        tl.to(cells[i], { autoAlpha: 1, ease: "power1.out", duration: 0.9 }, "<0.3");
        // The connector draws across the pan and only REACHES the box at its end
        // (added last + same duration as the pan so it lands as the camera does).
        tl.to(linkEls[i - 1], { strokeDashoffset: 0, ease: "power1.inOut", duration: 1.6 }, "<-0.3");
        // …then - only once the line has touched the box (">") - both sides hug
        // it, starting where the line met it and closing on the far edge.
        tl.to(hugEls[i], { strokeDashoffset: 0, ease: "power2.out", duration: 1.1 }, ">");
        tl.to({}, { duration: 0.9 }); // dwell
      }
      tl.to({}, { duration: 0.5 });
      // remove the dynamically-created tracer paths on cleanup / hot-reload
      return () => { svgEl.innerHTML = ""; };
      });
    },
    { scope: wrap }
  );

  return (
    <section className="how" ref={wrap} id="how">
      <div className="how-heading" ref={heading} aria-hidden>
        How it works
      </div>
      <div className="how-viewport">
        <div className="how-stage" ref={stage}>
          {/* one continuous tracer: hugs each box, then a line threads to the
              next box and hugs it too. Path + viewBox built at runtime. */}
          <svg className="how-tracer" ref={svg} aria-hidden preserveAspectRatio="none" />
          {/* tracer <path>s are created at runtime from the boxes' positions */}
          {STEPS.map((s) => (
            <div className="how-cell" key={s.n} style={s.pos}>
              <div className="how-cell-inner">
                <div className="how-text">
                  <span className="how-num">{s.n}</span>
                  <h3 className="how-title">{s.title}</h3>
                  <p className="how-body">{s.body}</p>
                </div>
                <StepVisual id={s.id} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
