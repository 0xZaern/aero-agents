"use client";

/** Generic scroll reveal - fades+slides a block in once via IntersectionObserver. */
import { useEffect, useRef, ReactNode, CSSProperties, ElementType } from "react";

interface Props {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  delay?: number;
}

export default function Reveal({ children, as: Tag = "div", className = "", style, delay = 0 }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e], obs) => {
        if (e.isIntersecting) {
          (el as HTMLElement).style.transitionDelay = `${delay}ms`;
          el.classList.add("is-in");
          obs.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    <Tag ref={ref} data-reveal className={className} style={style}>
      {children}
    </Tag>
  );
}
