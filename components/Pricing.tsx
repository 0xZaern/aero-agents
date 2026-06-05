"use client";

import RevealText from "./RevealText";
import Reveal from "./Reveal";
import MagneticButton from "./MagneticButton";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    note: "",
    features: [
      "Chat with all frontier models",
      "Web + Telegram",
      "Pay only for what you use",
      "$1 in free credits to start",
    ],
    cta: "Start free",
    primary: false,
  },
  {
    name: "Pro",
    price: "$80",
    note: "/mo",
    features: [
      "Everything in Free",
      "50% off every model you use",
      "$20 in credits included",
      "Custom agents: create, run & save",
      "Multi-agent teams",
      "Task scheduler & analyzers",
      "Publish to the marketplace, earn when others use your agents (soon)",
    ],
    cta: "Go Pro",
    primary: true,
  },
];

export default function Pricing() {
  return (
    <section className="section" id="pricing">
      <div className="container">
        <Reveal className="section-head section-head-center">
          <RevealText as="h2" className="section-title">
            Simple pricing.
          </RevealText>
        </Reveal>

        <div className="pricing-grid">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} className={`pricing-card card ${p.primary ? "pricing-pro" : ""}`} delay={i * 80}>
              {p.primary && <span className="pricing-badge">Most popular</span>}
              <h3 className="pricing-name">{p.name}</h3>
              <div className="pricing-price">
                {p.price}
                {p.note && <span className="pricing-note">{p.note}</span>}
              </div>
              <ul className="pricing-features">
                {p.features.map((f) => (
                  <li key={f}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <MagneticButton href="#" className={`btn ${p.primary ? "btn-primary" : "btn-ghost"} pricing-cta`}>
                {p.cta}
              </MagneticButton>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
