"use client";

import { useState } from "react";
import RevealText from "./RevealText";
import Reveal from "./Reveal";
import { useCursorHover } from "@/lib/cursor";
import { MODEL_COUNT, PROVIDER_COUNT } from "@/lib/models";

const ITEMS = [
  {
    q: "Which models can I use?",
    a: `${MODEL_COUNT} frontier models across ${PROVIDER_COUNT} providers: Claude, GPT, Gemini, DeepSeek, Llama, Grok, Qwen, Kimi, MiniMax, GLM and Mistral. Switch between any of them mid-conversation.`,
  },
  {
    q: "What makes an agent different from a chatbot?",
    a: "An agent has a job, a personality, and tools it can use on its own: web search, URL reading, code execution. It acts without asking you for every step.",
  },
  {
    q: "How does cost tracking work?",
    a: "Every request is tracked: tokens in, tokens out, exact cost. See spending per model, per day, per conversation, with monthly and all-time dashboards.",
  },
  {
    q: "Can I use it from Telegram?",
    a: "Yes. Same models, same features, straight from Telegram. Link your account and scheduled tasks can deliver results to your DMs too.",
  },
  {
    q: "How do I pay?",
    a: "Sign in with your wallet and pay with USDC on Base. No credit cards, no middlemen. New accounts get $1 in starting credits.",
  },
];

function Row({ item, open, onToggle }: { item: (typeof ITEMS)[number]; open: boolean; onToggle: () => void }) {
  const hover = useCursorHover();
  return (
    <div className={`faq-row ${open ? "open" : ""}`}>
      <button className="faq-q" onClick={onToggle} {...hover}>
        <span>{item.q}</span>
        <span className="faq-icon">{open ? "−" : "+"}</span>
      </button>
      <div className="faq-a-wrap">
        <p className="faq-a">{item.a}</p>
      </div>
    </div>
  );
}

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="section" id="faq">
      <div className="container faq-container">
        <Reveal className="section-head section-head-center">
          <RevealText as="h2" className="section-title faq-title">
            Questions, answered.
          </RevealText>
        </Reveal>
        <Reveal className="faq-list">
          {ITEMS.map((item, i) => (
            <Row key={i} item={item} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
