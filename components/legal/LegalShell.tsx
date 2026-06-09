import Link from "next/link";
import Nav from "@/components/Nav";

/**
 * LegalShell - shared chrome for the standalone Terms / Privacy routes. Uses the
 * homepage Nav (forced solid) so these pages share the site header, then a slim
 * footer. Docs has its own sidebar layout and renders Nav itself.
 */
export default function LegalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="legal-page">
      <Nav solid />
      <div className="legal-wrap">{children}</div>
    </div>
  );
}

export function LegalFooter({ links }: { links: { label: string; href: string }[] }) {
  return (
    <div className="legal-foot">
      <span className="legal-foot-brand">aero</span>
      <div className="legal-foot-links">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
