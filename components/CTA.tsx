"use client";

import dynamic from "next/dynamic";
import RevealText from "./RevealText";
import Reveal from "./Reveal";
import MagneticButton from "./MagneticButton";
import { useLaunch } from "@/lib/dash/stores/authModalStore";

// three.js mesh deferred to its own chunk so it never blocks the CTA text.
const CtaMesh = dynamic(() => import("./CtaMesh"), { ssr: false });

export default function CTA() {
  const launch = useLaunch();
  return (
    <section className="cta">
      <CtaMesh />
      <div className="container cta-inner">
        <RevealText as="h2" className="cta-title" splitBy="word">
          Start here.
        </RevealText>
        <Reveal delay={120}>
          <p className="lead cta-lead">
            Pick a model, an agent, or a team. Ask anything, run tasks, see exactly what it cost.
          </p>
        </Reveal>
        <Reveal delay={220}>
          <MagneticButton href="/dashboard/chat" onClick={launch} className="btn btn-primary cta-btn">
            Launch App
          </MagneticButton>
        </Reveal>
      </div>
    </section>
  );
}
