"use client";

/**
 * AgentsScroll - pinned section whose inner track scrolls horizontally as you
 * scroll vertically. Classic "cool scroll" gallery, aero-styled.
 */

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useCursorHover } from "@/lib/cursor";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const AGENTS = [
  { name: "Researcher", role: "Searches the web, reads URLs, pulls sources together for answers with receipts." },
  { name: "Coder", role: "Writes and runs code. Python, JS, debugging. Thinks like a senior engineer." },
  { name: "Writer", role: "Blog posts, emails, reports, marketing copy. Adapts tone, zero filler." },
  { name: "Analyst", role: "Crunches data, spots patterns, backs every conclusion with executed code." },
  { name: "Critic", role: "Reviews work for quality and logic. Fact-checks claims by searching the web." },
  { name: "Summarizer", role: "Reads long articles, docs and URLs. Hands you the key points, fast." },
  { name: "X Agent", role: "Drafts high-engagement reply and post variants from a brief, ready to copy." },
  { name: "Scheduler", role: "Runs recurring tasks on a schedule and delivers the results on time, to chat or Telegram." },
  { name: "Project Analyzer", role: "Forensic audit of any crypto project URL. Honest legitimacy verdict, no hype." },
  { name: "Docs Agent", role: "Audits documentation for clarity, gaps and accuracy. Tells you what to fix." },
  { name: "GitHub Analyzer", role: "Paste any public repo. Returns a developer-level audit of code quality and red flags." },
  { name: "YouTube Agent", role: "Turns any video into tight, skimmable key points. No fluff." },
  { name: "Caveman Agent", role: "Strips every filler word. Dense, terse answers, code blocks stay clean." },
];

function Card({ a, i }: { a: (typeof AGENTS)[number]; i: number }) {
  const hover = useCursorHover("card");
  return (
    <article className="ag-card card" {...hover}>
      <span className="ag-index">{String(i + 1).padStart(2, "0")}</span>
      <h3 className="ag-name">{a.name}</h3>
      <p className="ag-role">{a.role}</p>
    </article>
  );
}

export default function AgentsScroll() {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = wrap.current, tr = track.current;
      if (!el || !tr) return;
      const distance = () => tr.scrollWidth - window.innerWidth + 96;
      gsap.to(tr, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: () => "+=" + distance(),
          pin: true,
          scrub: 0.5,
          invalidateOnRefresh: true,
        },
      });
    },
    { scope: wrap }
  );

  return (
    <section className="agents-scroll" ref={wrap} id="agents">
      <div className="ag-header">
        <h2 className="section-title">An AI with a job.</h2>
        <p className="lead">
          Not chatbots. Each agent has a personality and tools it uses without asking. Swap the model, rewrite
          the prompt, or build your own.
        </p>
      </div>
      <div className="agents-track" ref={track}>
        <span className="ag-track-label">
          <span className="ag-track-num">{AGENTS.length}</span> presets
          <br />
          <span className="ag-track-dim">infinite custom</span>
        </span>
        {AGENTS.map((a, i) => (
          <Card key={a.name} a={a} i={i} />
        ))}
        <div className="ag-end">
          <span className="ag-index">+</span>
          <h3 className="ag-name">Build your own</h3>
          <p className="ag-role">Pick tools, set a personality, publish to the community marketplace.</p>
        </div>
      </div>
    </section>
  );
}
