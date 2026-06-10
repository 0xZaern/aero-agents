"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// On mobile, the browser fires a resize every time the URL bar shows/hides
// during scroll. Without this, ScrollTrigger recomputes every pin mid-scroll
// and the page visibly jumps ("scroll moves me down"), worst at the boundary
// between two pinned sections (hero → manifesto). Ignoring those tiny mobile
// resizes keeps the pin ranges stable while scrolling.
ScrollTrigger.config({ ignoreMobileResize: true });

const LenisContext = createContext<{ lenis: Lenis | null }>({ lenis: null });
export const useLenis = () => useContext(LenisContext);

export function LenisProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const [instance, setInstance] = useState<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });
    lenisRef.current = lenis;
    const rafId = requestAnimationFrame(() => setInstance(lenis));

    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // Pin positions are computed from layout. Late reflows (web fonts loading,
    // window load, resize) shift section offsets and leave pinned ScrollTriggers
    // stale - refresh after each so pins land on the right scroll ranges.
    const refresh = () => ScrollTrigger.refresh();
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(refresh);
    }
    window.addEventListener("load", refresh);
    const refreshT = setTimeout(refresh, 1200);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(refreshT);
      window.removeEventListener("load", refresh);
      lenis.off("scroll", ScrollTrigger.update);
      gsap.ticker.remove(tick);
      lenis.destroy();
      setInstance(null);
    };
  }, []);

  return <LenisContext.Provider value={{ lenis: instance }}>{children}</LenisContext.Provider>;
}
