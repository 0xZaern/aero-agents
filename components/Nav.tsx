"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Logo from "./Logo";
import { useCursorHover } from "@/lib/cursor";
import MagneticButton from "./MagneticButton";
import { useLaunch } from "@/lib/dash/stores/authModalStore";
import { SOCIAL } from "@/lib/social";

// Fable 5 coachmark: shows once per browser, and the whole promo auto-disables
// after the launch window closes (self-cleaning, no need to remove the code).
const FABLE_HINT_KEY = "fable5-hint-seen";
const FABLE_HINT_UNTIL = new Date("2026-07-08T00:00:00Z").getTime();

// Absolute hrefs (leading "/") so the nav works from any route - on the home
// page they resolve to the same-page section; from /docs, /terms, /privacy they
// navigate home and scroll to the section. "Docs" is its own route.
const LINKS = [
  { label: "Models", href: "/#models", badge: "New" },
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
  const [hint, setHint] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const linkHover = useCursorHover();
  const launch = useLaunch();
  const pathname = usePathname();

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

  // First-visit coachmark for the new Fable 5 model: homepage only, once per
  // browser. Mark "seen" as soon as it shows so it never nags on reload.
  useEffect(() => {
    if (pathname !== "/") return;
    if (Date.now() > FABLE_HINT_UNTIL) return; // launch window closed
    if (localStorage.getItem(FABLE_HINT_KEY)) return;
    const t = setTimeout(() => {
      setHint(true);
      localStorage.setItem(FABLE_HINT_KEY, "1");
    }, 1400);
    return () => clearTimeout(t);
  }, [pathname]);

  // Close mobile drawer on route change and on outside click.
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const dismissHint = () => setHint(false);

  return (
    <>
      <nav className={`aero-nav ${scrolled || solid ? "scrolled" : ""} ${shown ? "shown" : ""}`}>
        <div className="aero-nav-inner">
          <Link href="/" className="aero-nav-logo" {...linkHover}>
            <Logo />
          </Link>

          <div className="aero-nav-links">
            {LINKS.map((l) => {
              const link = (
                <a href={l.href} className={l.badge ? "aero-nav-link" : undefined} {...linkHover}>
                  {l.label}
                  {l.badge && <span className="aero-nav-badge">{l.badge}</span>}
                </a>
              );
              if (!l.badge) return <span key={l.href}>{link}</span>;
              return (
                <span key={l.href} className="aero-nav-hint-anchor">
                  {link}
                  {hint && (
                    <div className="fable-hint" role="status">
                      <button type="button" className="fable-hint-close" onClick={dismissHint} aria-label="Dismiss">
                        ×
                      </button>
                      <div className="fable-hint-title">
                        <span className="fable-hint-tag">New</span>Claude Fable&nbsp;5
                      </div>
                      <p className="fable-hint-body">
                        Claude&apos;s most powerful model just landed.
                      </p>
                      <a
                        href="/dashboard/chat"
                        className="fable-hint-cta"
                        onClick={(e) => {
                          launch(e);
                          dismissHint();
                        }}
                        {...linkHover}
                      >
                        Try Fable&nbsp;5 →
                      </a>
                    </div>
                  )}
                </span>
              );
            })}
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
              <a className="theme-toggle" href={SOCIAL.telegram} target="_blank" rel="noopener noreferrer" aria-label="Telegram" title="Telegram" {...linkHover}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M21.94 4.6l-3.32 15.66c-.25 1.1-.9 1.38-1.83.86l-5.05-3.72-2.44 2.35c-.27.27-.5.5-1 .5l.36-5.13L17.99 6.3c.4-.36-.09-.56-.62-.2L6.97 12.66l-4.99-1.56c-1.08-.34-1.1-1.08.23-1.6l19.5-7.52c.9-.34 1.69.2 1.23 2.62z" />
                </svg>
              </a>
            </div>
            <MagneticButton href="/dashboard/chat" onClick={launch} className="btn btn-ghost aero-nav-cta">
              Launch App
            </MagneticButton>

            {/* Hamburger: only visible <=760px */}
            <button
              type="button"
              className="aero-nav-hamburger"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                {mobileOpen ? (
                  <>
                    <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <line x1="3" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="aero-nav-backdrop"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile nav drawer */}
      <div
        ref={drawerRef}
        className={`aero-nav-drawer ${mobileOpen ? "open" : ""}`}
        aria-hidden={!mobileOpen}
      >
        <nav aria-label="Mobile navigation">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="aero-nav-drawer-link"
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
              {l.badge && <span className="aero-nav-badge aero-nav-badge-inline">{l.badge}</span>}
            </a>
          ))}
        </nav>
        <div className="aero-nav-drawer-foot">
          <div className="aero-nav-social">
            <a className="theme-toggle" href={SOCIAL.x} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a className="theme-toggle" href={SOCIAL.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            </a>
            <a className="theme-toggle" href={SOCIAL.telegram} target="_blank" rel="noopener noreferrer" aria-label="Telegram">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21.94 4.6l-3.32 15.66c-.25 1.1-.9 1.38-1.83.86l-5.05-3.72-2.44 2.35c-.27.27-.5.5-1 .5l.36-5.13L17.99 6.3c.4-.36-.09-.56-.62-.2L6.97 12.66l-4.99-1.56c-1.08-.34-1.1-1.08.23-1.6l19.5-7.52c.9-.34 1.69.2 1.23 2.62z" />
              </svg>
            </a>
          </div>
          <a
            href="/dashboard/chat"
            className="btn btn-ghost aero-nav-cta"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={(e) => { launch(e); setMobileOpen(false); }}
          >
            Launch App
          </a>
        </div>
      </div>
    </>
  );
}
