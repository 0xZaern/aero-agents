"use client";

import RevealText from "./RevealText";
import Reveal from "./Reveal";

const CREWS = [
  {
    name: "Research Team",
    chain: ["Researcher", "Analyst", "Writer"],
    body: "Digs up information, finds the patterns, turns it into a polished report. Deep dives on any topic.",
  },
  {
    name: "Content Pipeline",
    chain: ["Researcher", "Writer", "Critic"],
    body: "Research, write, then tear it apart. The Critic catches every weak point so your content ships sharper.",
  },
  {
    name: "Code Review",
    chain: ["Coder", "Critic"],
    body: "The Coder writes the solution, the Critic reviews for bugs, edge cases and quality. A senior dev on every PR.",
  },
];

export default function Crews() {
  return (
    <section className="section" id="teams">
      <div className="container">
        <Reveal className="section-head">
          <RevealText as="h2" className="section-title">
            Why one agent when you can use three?
          </RevealText>
          <p className="lead">
            A team is a group of agents working the same task in sequence. Each does its part and passes the
            result on. You watch it happen, step by step, in real time.
          </p>
        </Reveal>

        <div className="crew-list">
          {CREWS.map((c, i) => (
            <Reveal key={c.name} className="crew-row card" delay={i * 70}>
              <div className="crew-meta">
                <span className="crew-num">0{i + 1}</span>
                <h3 className="crew-name">{c.name}</h3>
              </div>
              <div className="crew-chain">
                {c.chain.map((step, j) => (
                  <span key={step} className="crew-step">
                    {step}
                    {j < c.chain.length - 1 && <span className="crew-arrow">→</span>}
                  </span>
                ))}
              </div>
              <p className="crew-body">{c.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
