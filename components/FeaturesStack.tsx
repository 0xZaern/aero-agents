"use client";

/**
 * FeaturesStack - sticky stacking cards. Each card pins, the next slides up to
 * cover it, and the buried card scales + dims for depth (scrubbed).
 */

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MODEL_COUNT } from "@/lib/models";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const FEATURES = [
  { n: "01", title: "Multi-model chat", body: `Switch between ${MODEL_COUNT} frontier models mid-conversation. Real-time streaming over WebSocket. Pin chats, organize in folders, attach images and documents.` },
  { n: "02", title: "Agents that act", body: "Agents with a job and tools - they search the web, read URLs and run code on their own. Build from scratch or clone from the community marketplace." },
  { n: "03", title: "Teams", body: "Chain agents into sequential workflows. Researcher → Analyst → Writer. Watch execution step by step with per-agent cost tracking." },
  { n: "04", title: "Task scheduler", body: "Automate recurring AI work. Time-based or watch-mode triggers on Twitter, RSS and URLs. Results delivered in-app and via Telegram." },
  { n: "05", title: "Cost intelligence", body: "Track every token spent - per message, per model, daily and monthly. Know exactly what each conversation costs. No surprises." },
  { n: "06", title: "Crypto native", body: "Sign in with your wallet. Pay with USDC on Base. No credit cards, no middlemen. Your keys, your account." },
];

export default function FeaturesStack() {
  const wrap = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>(".stack-card", wrap.current!);
      cards.forEach((card, i) => {
        if (i === cards.length - 1) return;
        gsap.to(card, {
          scale: 0.9,
          filter: "brightness(0.6)",
          ease: "none",
          scrollTrigger: {
            trigger: cards[i + 1],
            start: "top bottom",
            end: "top top",
            scrub: 0.5,
          },
        });
      });
    },
    { scope: wrap }
  );

  return (
    <section className="section" id="features">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">What you get</span>
          <h2 className="section-title">Everything, in one place.</h2>
        </div>
      </div>
      <div className="stack" ref={wrap}>
        {FEATURES.map((f) => (
          <div className="stack-card-wrap" key={f.n}>
            <div className="stack-card card">
              <span className="stack-num">{f.n}</span>
              <h3 className="stack-title">{f.title}</h3>
              <p className="stack-body">{f.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
