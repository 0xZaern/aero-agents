import type { Metadata } from "next";
import LegalShell, { LegalFooter } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Terms of Service - aero",
  description: "The terms that govern your use of aero.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

export default function TermsPage() {
  return (
    <LegalShell>
      <div className="legal-head">
        <div className="legal-eyebrow">Legal</div>
        <h1 className="legal-h1">Terms of Service</h1>
        <p className="legal-updated">Last updated: June 6, 2026</p>
      </div>

      <Section title="1. About This Agreement">
        <p>
          These Terms of Service govern your use of aero, an AI platform that gives you access to
          frontier language models, custom AI agents, and multi-agent teams. By connecting your
          wallet and using aero, you agree to these terms.
        </p>
        <p>
          If you do not agree, do not use the platform. We may update these terms over time -
          continued use after an update means you accept the new version.
        </p>
      </Section>

      <Section title="2. Eligibility">
        <p>To use aero, you must:</p>
        <Bullets
          items={[
            "Be at least 18 years old (or the age of legal majority in your jurisdiction).",
            "Have a compatible crypto wallet (e.g. MetaMask, Coinbase Wallet) on the Base network.",
            "Not be located in a jurisdiction where accessing AI platforms or crypto payments is prohibited.",
          ]}
        />
        <p>By connecting your wallet, you confirm that you meet these requirements.</p>
      </Section>

      <Section title="3. Account Creation">
        <p>
          aero uses wallet-based authentication. There is no email or password. Your wallet address
          is your identity on the platform.
        </p>
        <Bullets
          items={[
            "Connecting your wallet creates an account automatically.",
            "You may optionally link a Telegram account for access via the aero bot.",
            "You are responsible for the security of your wallet. We cannot recover access if you lose your wallet credentials.",
            "You may not share your account or use automated methods to create multiple accounts.",
          ]}
        />
      </Section>

      <Section title="4. Payment & Credits">
        <p>
          aero operates on a credit-based system. All payments are made in USDC on the Base
          blockchain.
        </p>
        <Bullets
          items={[
            "You receive $1 in free credits when you first connect your wallet.",
            "Credits are consumed when you send messages to AI models or run agent/team tasks.",
            "Credits are non-refundable once purchased. This is a no-refund platform.",
            "Pro plan is a 30-day recurring subscription billed in USDC. It renews automatically unless cancelled.",
            "Blockchain transactions are irreversible. Confirm payment amounts before approving.",
            "We are not responsible for failed transactions caused by network congestion, insufficient gas, or wallet issues.",
          ]}
        />
      </Section>

      <Section title="5. Acceptable Use">
        <p>You agree not to use aero to:</p>
        <Bullets
          items={[
            "Generate illegal content, including but not limited to content that violates copyright, privacy, or laws against harassment.",
            "Attempt to manipulate AI models into bypassing safety guidelines or producing harmful outputs.",
            "Automate scraping of our platform or use bots to artificially consume credits or resources.",
            "Probe, scan, or test the vulnerability of our systems without written permission.",
            "Impersonate other users, entities, or aero itself.",
            "Use the platform to facilitate spam, phishing, or fraud.",
          ]}
        />
        <p>
          We reserve the right to suspend or terminate accounts that violate these rules, at our
          sole discretion and without prior notice.
        </p>
      </Section>

      <Section title="6. Intellectual Property">
        <p>
          <strong>Your conversations:</strong> You own the content you input into aero. AI-generated
          responses are also yours to use, subject to the terms of the underlying model providers
          (Anthropic, OpenAI, Google, etc.).
        </p>
        <p>
          <strong>The platform:</strong> aero - including the interface, code, design, branding, and
          infrastructure - is owned by us. You may not copy, reverse-engineer, or redistribute any
          part of the platform without explicit written permission.
        </p>
        <p>
          AI models are provided by third-party model providers. We do not own those models. Their
          terms apply to the outputs they generate.
        </p>
      </Section>

      <Section title="7. Disclaimer & Limitation of Liability">
        <p>
          aero provides access to AI models. AI-generated content is not professional advice of any
          kind - legal, medical, financial, or otherwise. Do not rely on AI outputs for decisions
          with serious real-world consequences.
        </p>
        <Bullets
          items={[
            'The platform is provided "as is" with no guarantees of uptime, accuracy, or fitness for purpose.',
            "We are not liable for losses caused by AI errors, model downtime, or unexpected outputs.",
            "We are not liable for losses caused by smart contract bugs, network failures, or blockchain issues.",
            "Our total liability to you, for any reason, shall not exceed the amount you paid us in the 30 days before the incident.",
          ]}
        />
      </Section>

      <Section title="8. Termination">
        <p>We may suspend or terminate your access to aero at any time, with or without notice, if:</p>
        <Bullets
          items={[
            "You violate these Terms of Service.",
            "Your usage poses a risk to the platform or other users.",
            "We are required to do so by law or regulation.",
          ]}
        />
        <p>You may stop using aero at any time. Unused credits are not refundable upon termination.</p>
      </Section>

      <Section title="9. Changes to These Terms">
        <p>
          We may update these Terms of Service from time to time. When we do, we will update the
          &quot;Last updated&quot; date at the top of this page. If changes are significant, we may notify you
          via the platform. Continued use of aero after changes are published constitutes acceptance
          of the new terms.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          Questions about these terms? Reach out to us at{" "}
          <a className="legal-mail" href="mailto:team@aero.app">
            team@aero.app
          </a>
          .
        </p>
      </Section>

      <LegalFooter
        links={[
          { label: "Docs", href: "/docs" },
          { label: "Privacy", href: "/privacy" },
        ]}
      />
    </LegalShell>
  );
}
