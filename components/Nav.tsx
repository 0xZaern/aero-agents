"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { useCursorHover } from "@/lib/cursor";
import MagneticButton from "./MagneticButton";
import { useLaunch } from "@/lib/dash/stores/authModalStore";
import { SOCIAL } from "@/lib/social";

// Absolute hrefs (leading "/") so the nav works from any route - on the home
// page they resolve to the same-page section; from /docs, /terms, /privacy they
// navigate home and scroll to the section. "Docs" is its own route.
const LINKS = [
  { label: "Models", href: "/#models" },
  { label: "Agents", href: "/#agents" },
  { label: "Teams", href: "/#teams" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Docs", href: "/docs" },
];

// `solid` forces the scrolled (opaque) treatment - used on the standalone
// docs/legal routes where there's no hero behind the bar.
export default function Nav({ solid = false }: { solid?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [shown, setShown] = useState(false);
  const linkHover = useCursorHover();
  const launch = useLaunch();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const t = setTimeout(() => setShown(true), 200);
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, []);

  return (
    <nav className={`aero-nav ${scrolled || solid ? "scrolled" : ""} ${shown ? "shown" : ""}`}>
      <div className="aero-nav-inner">
        <Link href="/" className="aero-nav-logo" {...linkHover}>
          <Logo />
        </Link>

        <div className="aero-nav-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} {...linkHover}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="aero-nav-right">
          <div className="aero-nav-social">
            <a className="theme-toggle" href={SOCIAL.x} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" title="X (Twitter)" {...linkHover}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a className="theme-toggle" href={SOCIAL.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub" {...linkHover}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            </a>
          </div>
          <MagneticButton href="/dashboard/chat" onClick={launch} className="btn btn-ghost aero-nav-cta">
            Launch App
          </MagneticButton>
        </div>
      </div>
    </nav>
  );
}
