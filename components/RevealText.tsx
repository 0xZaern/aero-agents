"use client";

/**
 * RevealText - word/char/line mask slide-up driven by GSAP ScrollTrigger.
 * Each unit sits in an overflow:hidden clip-mask and slides from yPercent 105 → 0
 * with a stagger. Fires once on entering the viewport.
 */

import { useRef, ElementType, CSSProperties, ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface Props {
  as?: ElementType;
  children: ReactNode;
  splitBy?: "word" | "char" | "line";
  className?: string;
  style?: CSSProperties;
  stagger?: number;
  duration?: number;
  delay?: number;
  triggerStart?: string;
}

function tokenize(text: string, splitBy: "word" | "char" | "line"): string[] {
  if (splitBy === "line") return text.split("\n");
  if (splitBy === "char") return text.split("");
  return text.split(/(\n| )/).filter(Boolean);
}

export default function RevealText({
  as: Tag = "div",
  children,
  splitBy = "word",
  className,
  style,
  stagger = 0.065,
  duration = 0.7,
  delay = 0,
  triggerStart = "top 88%",
}: Props) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const wrap = ref.current;
      if (!wrap) return;
      const units = wrap.querySelectorAll<HTMLElement>("[data-unit]");
      if (!units.length) return;
      gsap.set(units, { yPercent: 108, willChange: "transform" });
      const tl = gsap.timeline({
        scrollTrigger: { trigger: wrap, start: triggerStart, once: true },
        delay,
      });
      tl.to(units, {
        yPercent: 0,
        duration,
        ease: "power3.out",
        stagger,
        onComplete: () => units.forEach((u) => (u.style.willChange = "auto")),
      });
      return () => tl.kill();
    },
    { scope: ref, dependencies: [stagger, duration, delay, triggerStart] }
  );

  function render(): ReactNode {
    if (typeof children !== "string") {
      return (
        <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", lineHeight: "inherit" }}>
          <span data-unit style={{ display: "inline-block", lineHeight: "inherit" }}>
            {children}
          </span>
        </span>
      );
    }
    return tokenize(children, splitBy).map((tok, i) => {
      if (tok === "\n") return <br key={i} />;
      if (tok === " ")
        return <span key={i} aria-hidden style={{ display: "inline-block", width: "0.28em" }} />;
      return (
        <span
          key={i}
          style={{
            display: "inline-block",
            overflow: "hidden",
            verticalAlign: "bottom",
            paddingBottom: "0.08em",
            marginBottom: "-0.08em",
            lineHeight: "inherit",
          }}
        >
          <span data-unit style={{ display: "inline-block", lineHeight: "inherit" }}>
            {tok}
          </span>
        </span>
      );
    });
  }

  return (
    <Tag ref={ref} className={className} style={style}>
      {render()}
    </Tag>
  );
}
