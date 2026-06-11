"use client";

import Logo from "./Logo";
import { useCursorHover } from "@/lib/cursor";
import { SOCIAL } from "@/lib/social";

const GROUPS = [
  {
    title: "Product",
    links: [
      { label: "Models", href: "/#models" },
      { label: "Agents", href: "/#agents" },
      { label: "Teams", href: "/#teams" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Developer API", href: "/docs#api" },
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
];

export default function Footer() {
  const hover = useCursorHover();
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo />
          <p className="footer-tag">One interface. Every AI model. Agents that actually do things.</p>
          <div className="footer-social" style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <a href={SOCIAL.x} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" title="X (Twitter)" {...hover}
               style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href={SOCIAL.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub" {...hover}
               style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            </a>
            <a href={SOCIAL.telegram} target="_blank" rel="noopener noreferrer" aria-label="Telegram" title="Telegram" {...hover}
               style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21.94 4.6l-3.32 15.66c-.25 1.1-.9 1.38-1.83.86l-5.05-3.72-2.44 2.35c-.27.27-.5.5-1 .5l.36-5.13L17.99 6.3c.4-.36-.09-.56-.62-.2L6.97 12.66l-4.99-1.56c-1.08-.34-1.1-1.08.23-1.6l19.5-7.52c.9-.34 1.69.2 1.23 2.62z" transform="translate(0 0)" />
              </svg>
            </a>
          </div>
        </div>
        {GROUPS.map((g) => (
          <div key={g.title} className="footer-col">
            <span className="footer-col-title">{g.title}</span>
            {g.links.map((l) => (
              <a key={l.label} href={l.href} {...hover}>
                {l.label}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="container footer-bottom">
        <span>© 2026 aero</span>
        <span className="footer-mono">built for people who run their own AI</span>
      </div>
    </footer>
  );
}
