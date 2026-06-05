"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import RevealText from "./RevealText";
import Reveal from "./Reveal";
import ModelWheel from "./ModelWheel";
import { MODELS, PROVIDERS } from "@/lib/models";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function Models() {
  const section = useRef<HTMLElement>(null);

  // Short scroll-lock: pin the section once it fills the viewport so the page
  // stops here for a beat (~0.6 viewport-heights of extra scroll) before the
  // user can move on. Respects reduced-motion (no pin).
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      ScrollTrigger.create({
        trigger: section.current!,
        start: "top top",
        end: "+=60%",
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
      });
    },
    { scope: section }
  );

  return (
    <section className="section models" id="models" ref={section}>
      <div className="container models-grid">
        <Reveal className="models-copy">
          <RevealText as="h2" className="section-title" splitBy="word">
            Every frontier model, one login.
          </RevealText>
          <p className="lead">
            Stop paying for five subscriptions. Switch models mid-conversation. Responses stream token by
            token, from the browser or straight from Telegram.
          </p>

          <div className="models-stats">
            <div className="models-stat">
              <span className="models-stat-num">{MODELS.length}</span>
              <span className="models-stat-label">frontier models</span>
            </div>
            <div className="models-stat">
              <span className="models-stat-num">{PROVIDERS.length}</span>
              <span className="models-stat-label">providers</span>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <ModelWheel models={MODELS} />
        </Reveal>
      </div>
    </section>
  );
}
