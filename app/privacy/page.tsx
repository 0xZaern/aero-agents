import type { Metadata } from "next";
import LegalShell, { LegalFooter } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy - aero",
  description: "How aero handles your data. Wallet-based, minimal collection.",
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

export default function PrivacyPage() {
  return (
    <LegalShell>
      <div className="legal-head">
        <div className="legal-eyebrow">Legal</div>
        <h1 className="legal-h1">Privacy Policy</h1>
        <p className="legal-updated">Last updated: June 6, 2026</p>
      </div>

      <Section title="1. Overview">
        <p>
          aero is designed with minimal data collection in mind. We are a wallet-based platform -
          you never give us your name, email, or any personal identification. This policy explains
          exactly what we do collect, why, and how it is protected.
        </p>
        <p>By using aero, you agree to the data practices described here.</p>
      </Section>

      <Section title="2. Data We Collect">
        <p>We collect only what is necessary to operate the platform:</p>
        <Bullets
          items={[
            "Your wallet address - this is your unique identifier on aero.",
            "Telegram account ID and username - only if you choose to link a Telegram account.",
            "Conversation history - messages you send and AI responses, stored so you can access your chat history.",
            "Agent and team configurations - names, system prompts, tool settings, and model choices you define.",
            "Usage data - token counts per message, credit balance, and billing history.",
            "Session data - authentication tokens stored in your browser's localStorage.",
          ]}
        />
      </Section>

      <Section title="3. What We Do NOT Collect">
        <p>We do not collect or store the following:</p>
        <Bullets
          items={[
            "Your name, email address, phone number, or any other personal identifier beyond your wallet address.",
            "Passwords - we use wallet signatures, not passwords.",
            "Tracking cookies or cross-site advertising data.",
            "Device fingerprints or behavioral tracking data beyond what is strictly needed to operate the service.",
            "Private keys or seed phrases - these never leave your wallet.",
          ]}
        />
      </Section>

      <Section title="4. How We Use Your Data">
        <p>We use the data we collect to:</p>
        <Bullets
          items={[
            "Authenticate you and associate your wallet address with your account.",
            "Deliver AI model responses and run your agents and teams.",
            "Track credit consumption and calculate billing accurately.",
            "Store your conversation history so you can return to past chats.",
            "Improve platform reliability and performance (aggregate, non-personal analytics).",
          ]}
        />
        <p>We do not sell your data. We do not use your conversations to train AI models.</p>
      </Section>

      <Section title="5. Third Parties">
        <p>Running aero requires working with the following third parties:</p>
        <Bullets
          items={[
            "AI model providers (Anthropic, OpenAI, Google, DeepSeek, Meta, xAI, Moonshot, Alibaba, MiniMax, Z.ai, Mistral) - your messages are sent to these providers to generate responses. Each provider's privacy policy applies to their model inference.",
            "Managed cloud infrastructure - a managed PostgreSQL database and object storage provider. Conversation history, agent configs, and account data are stored in hosted PostgreSQL, and uploaded files are kept in private object storage.",
            "Telegram - if you link a Telegram account, your Telegram ID and username are stored and used to authenticate you via the bot.",
            "Base / Ethereum network - payments are processed on the Base blockchain. Payment transactions are publicly visible on-chain by nature.",
          ]}
        />
        <p>
          We do not share your data with advertisers, data brokers, or any third party not listed
          here.
        </p>
      </Section>

      <Section title="6. Data Storage & Security">
        <Bullets
          items={[
            "All account and conversation data is stored in managed PostgreSQL, encrypted at rest.",
            "Uploaded files are kept in a private storage bucket and served only through signed links, never public URLs.",
            "Authentication uses wallet signatures - your private key is never transmitted to us.",
            "We use HTTPS for all data in transit.",
            "Auth tokens are stored in browser localStorage. You should use a secure, personal device.",
          ]}
        />
        <p>
          No security system is perfect. We are not responsible for breaches outside of our control,
          including those caused by your device being compromised.
        </p>
      </Section>

      <Section title="7. Data Retention">
        <Bullets
          items={[
            "Conversations are kept until you delete them or request account deletion.",
            "Account data (wallet address, credit balance, agent configs) is kept while your account is active.",
            "If you request account deletion, we will remove your data within 30 days, except where we are required to retain it by law.",
            "Blockchain payment records are permanent and cannot be deleted - they are public by the nature of the Base blockchain.",
          ]}
        />
      </Section>

      <Section title="8. Your Rights">
        <p>You can, at any time:</p>
        <Bullets
          items={[
            "Delete individual conversations from within the app.",
            "Unlink your Telegram account from your aero account.",
            "Request full account deletion by contacting us at the email below.",
            "Request a copy of the data we hold about you.",
          ]}
        />
      </Section>

      <Section title="9. Cookies & Local Storage">
        <p>We do not use tracking cookies or third-party analytics cookies.</p>
        <p>
          We use browser <span className="legal-code">localStorage</span> to store:
        </p>
        <Bullets
          items={[
            "Your authentication token (so you stay logged in).",
            "UI preferences such as theme selection.",
            "Any background image you set for the app.",
          ]}
        />
        <p>This data stays on your device and is not sent to any server.</p>
      </Section>

      <Section title="10. Blockchain Data">
        <p>
          Payments made through aero are processed on the Base blockchain. Your wallet address and
          transaction amounts are publicly visible on-chain. This is an inherent property of public
          blockchains and outside of our control. If on-chain privacy is a concern for you, consider
          using a wallet address that is not linked to your identity.
        </p>
      </Section>

      <Section title="11. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date at the top of
          this page will change when we do. Continued use of aero after an update constitutes
          acceptance of the revised policy.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>
          Questions, data requests, or deletion requests:{" "}
          <a className="legal-mail" href="mailto:team@aero.app">
            team@aero.app
          </a>
          .
        </p>
      </Section>

      <LegalFooter
        links={[
          { label: "Docs", href: "/docs" },
          { label: "Terms", href: "/terms" },
        ]}
      />
    </LegalShell>
  );
}
