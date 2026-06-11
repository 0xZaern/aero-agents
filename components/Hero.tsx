"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import MagneticButton from "./MagneticButton";
import { useLaunch } from "@/lib/dash/stores/authModalStore";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function Hero() {
  const sec = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const launch = useLaunch();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 120);
    return () => clearTimeout(t);
  }, []);

  // Push-through: as you scroll, the hero scales up + fades + blurs, as if the
  // camera flies forward through it onto the mesh below. Pinned + scrubbed over
  // a long distance so the descent is slow and cinematic.
  useGSAP(
    () => {
      if (!sec.current || !content.current) return;
      // Pinned flythrough is desktop-only. On phones the dynamic URL bar fights
      // the pin (the page jumps), so below 768px the hero is a plain static
      // section - the title still reveals via the CSS `.in` class.
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        gsap.to(content.current, {
          scale: 2.4,
          opacity: 0,
          filter: "blur(7px)",
          ease: "power1.in",
          scrollTrigger: { trigger: sec.current, start: "top top", end: "+=200%", pin: true, scrub: 0.6 },
        });
        const cue = sec.current!.querySelector(".hero-scroll");
        if (cue) {
          gsap.to(cue, {
            opacity: 0,
            ease: "none",
            scrollTrigger: { trigger: sec.current, start: "top top", end: "+=12%", scrub: 0.5 },
          });
        }
      });
    },
    { scope: sec }
  );

  return (
    <section className="hero" id="top" ref={sec}>
      <div className={`hero-content ${mounted ? "in" : ""}`} ref={content}>
        <h1 className="hero-title">
          <span className="ht-line">
            <span>Every model.</span>
          </span>
          <span className="ht-line">
            <span>Every agent.</span>
          </span>
          <span className="ht-line">
            <span>
              <em>One wallet.</em>
            </span>
          </span>
        </h1>

        <div className="hero-actions">
          <MagneticButton href="#" onClick={launch} className="btn btn-primary">
            Connect Wallet
          </MagneticButton>
          <MagneticButton href="#agents" className="btn btn-ghost">
            Browse agents →
          </MagneticButton>
        </div>
      </div>

      <div className="hero-scroll" aria-hidden>
        <span className="hero-scroll-line" />
        <span className="eyebrow">scroll to descend</span>
      </div>
    </section>
  );
}
