"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { PROVIDER_COUNT } from "@/lib/models";

/* ─── primitives ──────────────────────────────────────────────────────── */
function C({ children }: { children: React.ReactNode }) {
  return <code className="legal-code">{children}</code>;
}
function B({ children }: { children: React.ReactNode }) {
  return <strong>{children}</strong>;
}

const NAV = [
  { id: "about", label: "About" },
  { id: "getting-started", label: "Getting Started" },
  { id: "chat", label: "Chat" },
  { id: "models", label: "Models" },
  { id: "agents", label: "AI Agents" },
  { id: "crews", label: "Teams" },
  { id: "telegram", label: "Telegram Bot" },
  { id: "pricing", label: "Credits & Pricing" },
  { id: "settings", label: "Settings" },
  { id: "your-data", label: "Your Data" },
  { id: "api", label: "API" },
  { id: "rate-limits", label: "Rate Limits" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "faq", label: "FAQ" },
];

const MODELS: [string, string, string][] = [
  ["Claude Opus 4.8", "Anthropic", "Deep reasoning, nuanced writing, vision"],
  ["Claude Sonnet 4.6", "Anthropic", "Coding, analysis, fast everyday Claude"],
  ["GPT-5.4", "OpenAI", "Writing, creative, 1M context, vision"],
  ["GPT-5.4 Mini", "OpenAI", "Cheaper/faster GPT-5.4"],
  ["Gemini 3.1 Pro", "Google", "Google flagship, 1M context, vision"],
  ["Gemini 3.5 Flash", "Google", "Fast, long context, vision"],
  ["DeepSeek V4 Pro", "DeepSeek", "Flagship reasoning, 1M context"],
  ["DeepSeek V4 Flash", "DeepSeek", "Cheap + 1M context, budget pick"],
  ["Llama 3.3 70B", "Meta", "Open-source, balanced quality and cost"],
  ["Grok 4.20", "xAI", "Strong reasoning, 2M context, vision"],
  ["Kimi K2.6", "Moonshot", "Multilingual, non-English content, vision"],
  ["MiniMax M3", "MiniMax", "Modern reasoning, strong tool calling, vision"],
  ["GLM 5.1", "Z.ai", "Frontier open model, general purpose"],
  ["Qwen3 235B", "Alibaba", "Budget all-rounder, large model on the cheap"],
  ["Qwen3 Coder 480B", "Alibaba", "Dedicated coding model"],
  ["Mistral Small", "Mistral", "Efficient, long context, vision"],
];

const AGENTS: [string, string, string][] = [
  ["Researcher", "Market research, fact-checking, finding sources, competitive analysis", "web_search, url_reader"],
  ["Coder", "Writing code, debugging, explaining code, running scripts and calculations", "code_executor"],
  ["Writer", "Blog posts, emails, marketing copy, documentation, content drafts", "-"],
  ["Analyst", "Data analysis, pattern finding, statistical summaries, number crunching", "code_executor"],
  ["Critic", "Reviewing documents, fact-checking claims, quality assurance, proofreading", "web_search, url_reader"],
  ["Summarizer", "Summarizing articles, long documents, meeting notes, web pages", "url_reader"],
  ["Scheduler", "Setting up recurring or event-based automations (web-only)", "specialty"],
];

const CREWS: [string, string][] = [
  ["Research Team", "Give it a topic → Researcher searches multiple sources and gathers raw information → Analyst identifies patterns, key insights, and data points → Writer produces a polished, structured report"],
  ["Content Pipeline", "Give it a topic → Researcher gathers background information and supporting sources → Writer creates the full content draft → Critic reviews it for accuracy, factual errors, and quality issues"],
  ["Code Review", "Give it a coding task → Coder writes the full solution with explanations → Critic reviews the code for bugs, edge cases, security issues, and best practices"],
];

const COMMANDS: [string, string][] = [
  ["/start", "Initialize the bot and see welcome info"],
  ["/help", "Show all available commands"],
  ["/menu", "Open the model selector"],
  ["/new", "Clear conversation history and start fresh"],
  ["/link", "Generate a one-time code to link your web account"],
];

const PRICING: [string, string, string, string][] = [
  ["Qwen3 235B", "$0.15", "$0.75", "~$0.0004"],
  ["DeepSeek V4 Flash", "$0.17", "$0.35", "~$0.0002"],
  ["Mistral Small", "$0.19", "$0.75", "~$0.0004"],
  ["MiniMax M3", "$0.30", "$1.20", "~$0.0007"],
  ["Qwen3 Coder 480B", "$0.35", "$1.50", "~$0.0008"],
  ["Llama 3.3 70B", "$0.70", "$2.80", "~$0.0015"],
  ["Kimi K2.6", "$0.85", "$4.66", "~$0.0025"],
  ["GPT-5.4 Mini", "$0.94", "$5.63", "~$0.003"],
  ["Grok 4.20", "$1.42", "$2.83", "~$0.0017"],
  ["DeepSeek V4 Pro", "$1.73", "$3.80", "~$0.0022"],
  ["GLM 5.1", "$1.75", "$5.50", "~$0.003"],
  ["Gemini 3.5 Flash", "$1.55", "$9.45", "~$0.005"],
  ["Gemini 3.1 Pro", "$2.50", "$15.00", "~$0.008"],
  ["GPT-5.4", "$3.13", "$18.80", "~$0.01"],
  ["Claude Sonnet 4.6", "$3.60", "$18.00", "~$0.01"],
  ["Claude Opus 4.8", "$6.00", "$30.00", "~$0.02"],
];

const FAQ: [string, string][] = [
  ["Is my data private?", "Yes. Your account is tied to your wallet address, not an email or personal profile. No personal information is stored. Your conversations are stored server-side so you can access them across devices, but they are associated only with your wallet. Conversations are kept indefinitely until you delete them - see the Your Data section above for exact retention, deletion, and export behavior."],
  ["How are costs calculated?", "Based on tokens. Every message sends your text plus the full conversation history to the model (input tokens), and the model generates a response (output tokens). Both are charged at the model's per-token rate. Output tokens are always more expensive than input. Longer conversations cost more per message because the growing history increases input token count."],
  ["Can I use it without crypto?", "Currently wallet-based only. You need MetaMask and USDC on Base to top up credits. The free starting credits don't require any payment."],
  ["Can I switch models mid-conversation?", "Yes. Select a different model from the input bar at any point. The full conversation history is passed to the new model - it has complete context and picks up exactly where the previous model left off."],
  ["What happens when credits run out?", "You can't send new messages until you top up. All your existing conversations, history, and settings are preserved - nothing is deleted. Top up any amount to resume immediately."],
  ["Do I need Pro for basic chat?", "No. The Free plan includes every model and unlimited conversations. Pro is only needed if you want to use AI Agents (with tools like web search and code execution) or Teams (multi-agent pipelines)."],
  ["Is there a message limit?", "No limit on messages. You can send as many as your credits allow. There are no rate limits or daily caps."],
  ["What happens to my data if I disconnect my wallet?", "Your data stays. Your account is identified by your wallet address - if you reconnect the same wallet, everything is exactly as you left it. Conversations, settings, and credit balance are all preserved."],
  ["Is the Telegram bot free to use?", "Yes, the bot is available on both Free and Pro plans. You use the same credits whether you're chatting on the web or in Telegram. If your account is linked, the balance is unified across both."],
  ["Why USDC and not a regular card payment?", "USDC on Base is instant, requires no payment processor, has no chargeback risk, and costs less than a cent per transaction. There are no credit card fees passed on to you, no waiting for bank approval, and you keep full control of your money until you choose to spend it."],
];

function Th({ cols }: { cols: string[] }) {
  return (
    <tr className="th">
      {cols.map((c) => (
        <td key={c}>{c}</td>
      ))}
    </tr>
  );
}

export default function DocsPage() {
  const [activeId, setActiveId] = useState("about");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActiveId(e.target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    for (const { id } of NAV) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="legal-page">
      <Nav solid />

      <div className="docs-layout">
        {/* Sidebar */}
        <nav className="docs-sidebar">
          <div className="docs-sidebar-title">On this page</div>
          {NAV.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className={activeId === id ? "is-active" : ""}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Content */}
        <main className="docs-main">
          <div className="legal-head">
            <div className="legal-eyebrow">Documentation</div>
            <h1 className="legal-h1">Platform Guide</h1>
            <p className="legal-updated">Everything you need to know about aero.</p>
          </div>

          {/* About */}
          <div id="about" className="legal-section">
            <h2>What is aero?</h2>
            <h3>The Problem</h3>
            <p>Right now, if you want to use the best AI models, you&apos;re stuck paying for multiple subscriptions. ChatGPT Plus is $20/month. Claude Pro is $20/month. Gemini Advanced is another $20/month. That&apos;s $60+ per month for three chat windows that do essentially the same thing - and you&apos;re still missing DeepSeek, Llama, Grok, and others.</p>
            <p>On top of that, every platform locks you in. Your conversations don&apos;t transfer. You can&apos;t compare how different models handle the same question. And none of them let you build anything beyond basic chat - no agents, no automation, no workflows.</p>
            <h3>The Solution</h3>
            <p>aero puts every <B>frontier AI model</B> from {PROVIDER_COUNT} providers into one interface. Claude, GPT, Gemini, DeepSeek, Llama, Grok, Kimi, Qwen, MiniMax, GLM, Mistral - all accessible from the same chat window. Pick any model for any conversation. Switch mid-conversation if you want a second opinion. Pay only for what you actually use - no subscriptions, no monthly fees.</p>
            <h3>More Than a Chatbot</h3>
            <p>Most AI platforms are just chat windows. aero lets you build <B>AI Agents</B> - specialized assistants that don&apos;t just talk, they act. An agent has a defined role (researcher, coder, writer), a personality, and access to real tools:</p>
            <ul>
              <li><B>Web Search</B> - the agent searches the internet for current information</li>
              <li><B>URL Reader</B> - the agent reads and extracts content from any webpage</li>
              <li><B>Code Executor</B> - the agent writes and runs Python code in a sandbox</li>
            </ul>
            <p>Then go further: chain agents into <B>Teams</B>. A Team is a group of agents working on the same task in sequence. The Researcher finds information, the Analyst processes it, the Writer produces the final report. One prompt from you, three specialized AI steps, polished output - automatically.</p>
            <h3>Why It&apos;s Different</h3>
            <ul>
              <li><B>One platform, every model</B> - stop switching between five different AI apps. Every major model in one place.</li>
              <li><B>Pay per message, not per month</B> - no $20/month subscriptions. You pay for the tokens you actually use. A $1 credit can last hundreds of messages on budget models.</li>
              <li><B>AI that does things</B> - agents don&apos;t just chat. They search the web, read articles, run code, and produce real results.</li>
              <li><B>Multi-agent workflows</B> - Teams let you automate complex tasks that would normally require multiple tools and hours of work.</li>
              <li><B>Full cost transparency</B> - every message shows exactly what it cost. Daily and monthly breakdowns by model. No surprise bills.</li>
              <li><B>Privacy by default</B> - wallet-based login means no email, no password, no personal data. Your conversations are tied to your wallet, not your identity.</li>
              <li><B>Web + Telegram</B> - same models, same credits, same conversations on both platforms. Chat from your desktop or your phone.</li>
            </ul>
            <h3>Quick Start</h3>
            <p>Connect your wallet → get $1.00 free credits → start chatting. No signup form, no email verification, no credit card. Takes about 10 seconds.</p>
          </div>

          {/* Getting Started */}
          <div id="getting-started" className="legal-section">
            <h2>Getting Started</h2>
            <h3>Connect Your Wallet</h3>
            <p>aero uses wallet-based authentication. Your wallet address is your identity - no email, no password, no account form.</p>
            <p>Currently, aero supports <B>MetaMask</B> - the most widely used browser extension and mobile wallet. Install it from <B>metamask.io</B> if you don&apos;t have it yet.</p>
            <h3>Why Base Network?</h3>
            <p>Base is an Ethereum Layer 2 network built by Coinbase. It uses the same security as Ethereum but is significantly cheaper and faster. Gas fees on Base are typically under $0.01 per transaction - compared to several dollars on mainnet Ethereum. This makes small top-ups and everyday payments practical. When you connect your wallet, MetaMask will prompt you to add and switch to the Base network automatically if it&apos;s not already configured.</p>
            <h3>After Connecting</h3>
            <p>Your account is created automatically the first time you connect. No confirmation email, no waiting. Your username is derived from your wallet address (shown in truncated form, e.g. <C>0x1a2b…9f3c</C>). Every new wallet receives <B>$1.00 in free credits</B> to get started immediately. See <B>Credits &amp; Pricing</B> below for how credits work, per-model rates, and how to top up.</p>
          </div>

          {/* Chat */}
          <div id="chat" className="legal-section">
            <h2>Chat</h2>
            <h3>Interface Overview</h3>
            <p>The left sidebar lists all your conversations. Click any conversation to open it, or start a new one with <C>Ctrl+K</C> or the <B>New Chat</B> button at the top of the sidebar. The main area is where the conversation happens. At the bottom is the input area - this is also where you select your model, agent, and team before sending.</p>
            <h3>Attachments</h3>
            <p>Click the paperclip in the chat input to attach images (PNG/JPG/WebP) or documents (PDF, TXT, MD, CSV). Vision-capable models read images directly; documents get parsed into the conversation context. Models without vision will tell you they can&apos;t see images - switch to Claude, GPT-5, or Gemini and re-send.</p>
            <h3>Model, Agent &amp; Team Selectors</h3>
            <p>Below the message input bar you&apos;ll see three selectors separated by dots. From left to right: <B>Model</B> (which AI to use), <B>Agent</B> (optional role and tools), and <B>Team</B> (optional multi-agent pipeline). For a standard chat, just pick a model and leave the other two at their defaults.</p>
            <h3>Streaming Responses</h3>
            <p>Responses stream in token by token in real-time - you see the answer being written as the model generates it. This means you don&apos;t wait for the full response to finish before reading. You can scroll up to read earlier parts of a long response while it&apos;s still generating.</p>
            <h3>Keyboard Shortcuts</h3>
            <ul>
              <li><C>Ctrl+K</C> - start a new chat from anywhere</li>
              <li><C>Enter</C> - send your message</li>
              <li><C>Shift+Enter</C> - insert a new line without sending</li>
            </ul>
            <h3>Switching Models Mid-Conversation</h3>
            <p>You can change models at any point. The full conversation history is passed to the new model, so it has all the context from previous messages. Keep in mind that longer conversations cost more regardless of model, because the entire history is sent with each new message.</p>
            <h3>Organizing Your Chats</h3>
            <p>The chat sidebar groups conversations into <B>folders</B> with optional color tags. Drag any chat into a folder to organize, drag it back out to ungroup. Pin important chats to the top. Use the search bar to <B>full-text search</B> across every message in every conversation - it finds matches inside replies, not just titles.</p>
          </div>

          {/* Models */}
          <div id="models" className="legal-section">
            <h2>Available Models</h2>
            <p>Every model is available on both Free and Pro plans. Cost varies by model - the cheapest options can handle hundreds of messages for $1, while the most powerful ones cost more per response.</p>
            <table className="legal-table">
              <thead>
                <Th cols={["Model", "Provider", "Best for"]} />
              </thead>
              <tbody>
                {MODELS.map(([name, provider, best]) => (
                  <tr key={name}>
                    <td className="td-name">{name}</td>
                    <td className="td-mono">{provider}</td>
                    <td>{best}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>For per-token rates, cost-per-chat estimates, and how far $1 goes on each model, see <B>Credits &amp; Pricing</B> below.</p>
          </div>

          {/* Agents */}
          <div id="agents" className="legal-section">
            <h2>AI Agents <span className="legal-tag">PRO</span></h2>
            <h3>What Makes an Agent Different</h3>
            <p>A regular chat sends your message to a model and returns a response. An agent goes further: it has a <B>system prompt</B> that defines its role and constraints, it has access to <B>tools</B> it can use autonomously (like searching the web or running code), and it can take multiple steps to complete a task before replying. Instead of just answering, an agent can research, compute, and verify before giving you a result.</p>
            <h3>Preset Agents</h3>
            <table className="legal-table">
              <thead>
                <Th cols={["Agent", "Best for", "Tools"]} />
              </thead>
              <tbody>
                {AGENTS.map(([name, best, tools]) => (
                  <tr key={name}>
                    <td className="td-name">{name}</td>
                    <td>{best}</td>
                    <td className="td-mono">{tools}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>Available Tools</h3>
            <ul>
              <li><C>web_search</C> - searches the internet and returns relevant results with titles, URLs, and snippets. Useful for current events, finding sources, or anything that needs up-to-date information.</li>
              <li><C>url_reader</C> - fetches any publicly accessible URL and extracts the full text content. Use this to have an agent read an article, documentation page, or any web page you provide.</li>
              <li><C>code_executor</C> - runs Python code in an isolated sandbox and returns the output. See the sandbox notes below for what&apos;s allowed.</li>
            </ul>
            <h3>Code Execution Sandbox</h3>
            <p>When an agent runs Python, the code executes in a locked-down environment. Each call starts with a fresh workspace - nothing carries over between runs.</p>
            <p><B>What works:</B> the Python standard library (<C>math</C>, <C>statistics</C>, <C>json</C>, <C>csv</C>, <C>re</C>, <C>datetime</C>, …), data-science libraries (<C>numpy</C>, <C>pandas</C>, <C>matplotlib</C>, <C>scipy</C>, <C>sympy</C>), writing temporary files, and any pure computation.</p>
            <p><B>What doesn&apos;t work (on purpose):</B> no internet access, no access to the rest of the server&apos;s filesystem, no persistent state between calls, a hard 10-second timeout per call, and output capped at 2000 characters.</p>
            <h3>Temperature</h3>
            <p>Temperature controls how predictable vs. creative the agent&apos;s output is. <B>0.0</B> is fully deterministic - best for coding, data extraction, or any task where precision matters. <B>1.0</B> is maximally varied and creative, better for brainstorming or writing. The default is <B>0.7</B>. For research or analysis, lower temperatures (0.2-0.4) tend to produce more reliable results.</p>
            <h3>Creating Custom Agents</h3>
            <p>Go to <B>Agents</B> → &quot;New Agent&quot;. Configure a name and role, a system prompt (personality, constraints, and how the agent should approach tasks), the tools it can use (<C>web_search</C>, <C>url_reader</C>, <C>code_executor</C>), and the model and temperature.</p>
            <h3>Community Agents &amp; Marketplace</h3>
            <p>Pro users can publish their custom agents as <B>frozen snapshots</B> to a public catalog. Anyone (Free or Pro) can browse the Community tab, <B>clone</B> a snapshot into their own list, and run it. Cloning makes a private copy - the original snapshot stays immutable, so the version you cloned never changes underneath you.</p>
            <p><B>Marketplace (coming soon):</B> you&apos;ll be able to publish agents to a paid marketplace and <B>earn a share whenever other users run your agent</B>. Build something good once, get paid as it gets used.</p>
          </div>

          {/* Teams */}
          <div id="crews" className="legal-section">
            <h2>Teams <span className="legal-tag">PRO</span></h2>
            <h3>How Sequential Execution Works</h3>
            <p>A team runs agents one after another in a defined order. When you submit a prompt to a team:</p>
            <ul>
              <li><B>Step 1</B> - the first agent receives your original prompt and runs. It may use its tools (search, read URLs, run code) before producing its output.</li>
              <li><B>Step 2</B> - the second agent receives both your original prompt and the first agent&apos;s full output as its input. It processes and extends the work.</li>
              <li><B>Step 3+</B> - each subsequent agent receives all previous outputs, building on everything that came before it.</li>
              <li><B>Final output</B> - the last agent&apos;s response is the team&apos;s result. You can also review what each individual agent produced.</li>
            </ul>
            <h3>Preset Teams</h3>
            <table className="legal-table">
              <thead>
                <Th cols={["Team", "How it works"]} />
              </thead>
              <tbody>
                {CREWS.map(([name, how]) => (
                  <tr key={name}>
                    <td className="td-name">{name}</td>
                    <td>{how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>Watching Execution in Real-Time</h3>
            <p>While a team is running you can watch each agent work live. The interface shows which agent is currently active, what tool calls it&apos;s making, and streams its output as it generates. You can expand each agent&apos;s step to read its full output before the team finishes.</p>
            <h3>Custom Teams</h3>
            <p>Go to <B>Teams</B> → &quot;New Team&quot; to build your own pipeline. A custom team is just an ordered list of agents - minimum 2, maximum 6. The first one sees your prompt; every agent after that also sees all previous agents&apos; outputs, so put the research or data-gathering agents early and the polish / review agents last.</p>
            <p><B>Patterns that tend to work:</B> research → analyze → write; code → review; research → write → critique. Keep teams short - longer chains drift and cost more, because each step re-sends all prior outputs to the next model.</p>
          </div>

          {/* Telegram */}
          <div id="telegram" className="legal-section">
            <h2>Telegram Bot</h2>
            <h3>Finding the Bot</h3>
            <p>Search for <C>@aeroagents_bot</C> in Telegram, or use the link on the web app&apos;s Settings page to open it directly. Send <C>/start</C> to initialize - the bot will introduce itself and show available options.</p>
            <h3>Chatting</h3>
            <p>You don&apos;t need any special command to chat. Just type your message and send it. The bot responds using whatever model you&apos;ve currently selected. Responses are streamed when the model supports it, and longer responses are split into multiple messages automatically.</p>
            <h3>Switching Models</h3>
            <p>Send <C>/menu</C> to open the interactive model selector. This shows all available models with their approximate cost tiers. Select one and all future messages in that session will use it. Your selection persists between sessions until you change it again.</p>
            <h3>Commands</h3>
            <table className="legal-table">
              <tbody>
                {COMMANDS.map(([cmd, desc]) => (
                  <tr key={cmd}>
                    <td className="td-mono">{cmd}</td>
                    <td>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>Linking Your Account</h3>
            <p>Linking connects your Telegram identity to your web wallet account. Once linked, your credit balance is shared between both - top up on the web, spend in Telegram, or vice versa. Conversations made in Telegram also appear in your web history.</p>
            <ul>
              <li>Send <C>/link</C> to the bot - you&apos;ll receive a short one-time code.</li>
              <li>Open <B>Settings → Telegram</B> in the web app and paste the code.</li>
              <li>Both accounts are now linked and credits are unified.</li>
              <li>To disconnect later, use the <B>Unlink</B> button in <B>Settings → Telegram</B>.</li>
            </ul>
          </div>

          {/* Pricing */}
          <div id="pricing" className="legal-section">
            <h2>Credits &amp; Pricing</h2>
            <div className="legal-cards">
              <div className="legal-card">
                <div className="legal-card-tier">Free</div>
                <div className="legal-card-price">$0 <small>pay-as-you-go</small></div>
                <ul>
                  <li>Every frontier model</li>
                  <li>Pay only for what you use</li>
                  <li>$1.00 in free credits to start</li>
                  <li>Unlimited conversations, web + Telegram</li>
                </ul>
              </div>
              <div className="legal-card is-pro">
                <div className="legal-card-tier">Pro</div>
                <div className="legal-card-price">$80<small>/mo</small></div>
                <ul>
                  <li>Everything in Free</li>
                  <li>Create, run &amp; save custom AI Agents with tools</li>
                  <li>Multi-agent Teams</li>
                  <li>Task scheduler &amp; analyzers</li>
                  <li>Publish agents to the marketplace and earn when others use them (coming soon)</li>
                </ul>
              </div>
            </div>
            <h3>How Credits Work</h3>
            <p><B>1 credit = $1 USD.</B> Credits are deducted based on actual token usage per message - you&apos;re only charged for what you use. There are no hidden fees, no rounding up, and no minimum charge per message. The cheapest models can handle hundreds of messages for $1. The most powerful models cost more per message but are still much cheaper than most AI subscriptions if you don&apos;t chat constantly.</p>
            <h3>Understanding Tokens</h3>
            <p><B>Input tokens</B> are what you send to the model: your message plus the full conversation history. <B>Output tokens</B> are the model&apos;s response. Output is always more expensive (3-5x). Longer conversations cost more because the growing history increases input tokens with every message.</p>
            <h3>Model Pricing</h3>
            <p>Prices are per 1 million tokens. A typical short message is ~100 tokens, a detailed response is ~500-1,000 tokens.</p>
            <table className="legal-table">
              <thead>
                <Th cols={["Model", "Input / 1M", "Output / 1M", "~Cost per chat*"]} />
              </thead>
              <tbody>
                {PRICING.map(([name, input, output, est]) => (
                  <tr key={name}>
                    <td className="td-name">{name}</td>
                    <td className="td-mono">{input}</td>
                    <td className="td-mono">{output}</td>
                    <td>{est}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: "0.8rem" }}>*Estimated cost per short chat exchange (~200 input tokens + ~500 output tokens). Actual cost depends on conversation length and response size.</p>
            <h3>What USDC Is</h3>
            <p>USDC is a stablecoin - a digital currency pegged 1:1 to the US dollar. 1 USDC always equals $1. On Base chain, transfers are nearly instant and cost fractions of a cent. You don&apos;t need to understand crypto deeply to use it - think of it as digital dollars that live in your wallet.</p>
            <h3>How to Top Up</h3>
            <p>Go to <B>Credits</B> in the navigation. Enter the amount you want to add (minimum $1). Click <B>Top Up</B> - MetaMask will open and ask you to approve the USDC transfer. Confirm the transaction. Credits are added to your account in approximately 10 seconds once the transaction is confirmed on Base chain.</p>
          </div>

          {/* Settings */}
          <div id="settings" className="legal-section">
            <h2>Settings</h2>
            <h3>Theme</h3>
            <p>Toggle between <B>dark</B> and <B>light</B> across the interface. Your choice is persisted against your wallet, so the same theme shows up automatically on any device the moment you connect the same wallet. If you haven&apos;t connected a wallet yet, the theme falls back to <C>localStorage</C> in the current browser and syncs to your account the first time you connect.</p>
            <h3>Default Model</h3>
            <p>Pick which model opens automatically when you start a new chat. Every model stays available inside each conversation regardless of what you set here. Existing conversations are untouched - only brand-new chats pick up the new default.</p>
            <h3>Telegram</h3>
            <p>The <B>Telegram</B> section in Settings is where you link or unlink your account. Full walkthrough (<C>/link</C> code, paste flow, unified credits) lives in the <B>Telegram Bot</B> section above.</p>
          </div>

          {/* Your Data */}
          <div id="your-data" className="legal-section">
            <h2>Your Data</h2>
            <h3>Where it lives</h3>
            <p>Conversations, agents, teams, settings, and credit history are stored in Supabase (Postgres), encrypted at rest. Uploaded files (images, PDFs, attachments) go into Supabase Storage, scoped to your wallet address. Secrets like API keys and linked-Telegram tokens are per-account and never exposed client-side.</p>
            <h3>How long it&apos;s kept</h3>
            <p>There is no auto-purge. Everything stays until you delete it. Delete a conversation and the row plus every message in it is hard-deleted immediately. Delete your account and every conversation, agent, team, file, linked Telegram record, and credit ledger entry is wiped in the same transaction.</p>
            <h3>What can&apos;t be deleted</h3>
            <p>On-chain USDC top-up transactions are recorded on Base and are public and permanent - that&apos;s how the blockchain works, not a policy choice. Your wallet address is your account identifier, so anyone with your address can see the deposit amounts, but never the chat content.</p>
            <h3>Training</h3>
            <p>Your messages are not used to train any model. Each request is forwarded to the model&apos;s original provider for inference only, and discarded from our side once the response streams back.</p>
            <h3>Export or deletion request</h3>
            <p>No self-serve export button yet. Email us at <a href="mailto:team@aeroagents.io">team@aeroagents.io</a> with your wallet address and we&apos;ll send you a full JSON dump of your data - or wipe everything, if you&apos;d rather have it gone.</p>
          </div>

          {/* API */}
          <div id="api" className="legal-section">
            <h2>API</h2>
            <p>aero has a public developer API. Mint a key, point any HTTP client at it, and call the same models and agents the web app uses from your own app, bot, or backend. You write the frontend, aero does the work behind the key.</p>

            <h3>Get a key</h3>
            <p>Open <B>Dashboard → Developer API</B> and click <B>create key</B>. The key is shown <B>once</B> at creation (format <C>sk_aero_...</C>) and only its hash is stored, so copy it immediately. You can mint several keys (one per app); they all share one balance. Revoking a key deletes it and stops it working at once.</p>

            <h3>Base URL and auth</h3>
            <p>All endpoints live under <C>/v1</C> on your aero domain. Send the key as a Bearer token on every request:</p>
            <pre className="legal-pre">{`Base URL:  https://aeroagents.io/v1
Header:    Authorization: Bearer sk_aero_...`}</pre>

            <h3>Billing and the API wallet</h3>
            <p>The API has its <B>own credit wallet</B>, separate from the web-app credits. You top it up with <B>VVV (Venice Token)</B> on Base from the Developer API page, choosing a fixed amount (for example pay 0.8 VVV to add $10 of credits). Credits never expire and drain per call:</p>
            <ul>
              <li><B>Per-token</B> for every endpoint that runs a model (<C>/v1/chat</C>, <C>/v1/agent</C>, and all the agent endpoints): you pay the chosen model&apos;s token cost, summed across the whole pipeline.</li>
              <li><B>Flat fee</B> for pure-analysis calls (<C>/v1/slop</C>): no model, a small fixed price.</li>
            </ul>
            <p>When the wallet hits zero, calls return <C>402</C> until you top up. The same key keeps working after a top-up.</p>

            <h3>Endpoints</h3>
            <table className="legal-table">
              <tbody>
                <Th cols={["Method", "Path", "What it does", "Billing"]} />
                <tr><td>GET</td><td><C>/v1/models</C></td><td>List callable models and their per-token pricing</td><td>free</td></tr>
                <tr><td>POST</td><td><C>/v1/chat</C></td><td>Chat completion across any model</td><td>per-token</td></tr>
                <tr><td>POST</td><td><C>/v1/agent</C></td><td>Run a tool-using agent (researcher, coder, writer, analyst, critic, summarizer)</td><td>per-token</td></tr>
                <tr><td>POST</td><td><C>/v1/youtube</C></td><td>Transcribe and summarize a YouTube video</td><td>per-token</td></tr>
                <tr><td>POST</td><td><C>/v1/legitimacy</C></td><td>Legitimacy verdict on a crypto/web3 project URL</td><td>per-token</td></tr>
                <tr><td>POST</td><td><C>/v1/github</C></td><td>Analyze a public GitHub repository</td><td>per-token</td></tr>
                <tr><td>POST</td><td><C>/v1/docs</C></td><td>Analyze a documentation/product website</td><td>per-token</td></tr>
                <tr><td>POST</td><td><C>/v1/slop</C></td><td>AI-slop signal scan of text or code</td><td>flat fee</td></tr>
              </tbody>
            </table>

            <h3>Example: chat</h3>
            <pre className="legal-pre">{`curl https://aeroagents.io/v1/chat \\
  -H "Authorization: Bearer sk_aero_..." \\
  -H "Content-Type: application/json" \\
  -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"Hello"}]}'`}</pre>
            <p>Response:</p>
            <pre className="legal-pre">{`{
  "model": "claude-sonnet-4-6",
  "content": "Hi! How can I help?",
  "usage": {
    "inputTokens": 9,
    "outputTokens": 7,
    "creditsSpent": 0.0001,
    "creditsRemaining": 24.99
  }
}`}</pre>

            <h3>Example: agent</h3>
            <p>Run a tool-using agent. <C>agent</C> is one of <C>researcher</C>, <C>coder</C>, <C>writer</C>, <C>analyst</C>, <C>critic</C>, <C>summarizer</C>. It uses its tools (web search, URL read, code exec) as needed and returns the final answer.</p>
            <pre className="legal-pre">{`curl https://aeroagents.io/v1/agent \\
  -H "Authorization: Bearer sk_aero_..." \\
  -H "Content-Type: application/json" \\
  -d '{"agent":"researcher","message":"Latest Base chain TVL trend","model":"claude-fable-5"}'`}</pre>
            <p>Response:</p>
            <pre className="legal-pre">{`{
  "model": "claude-fable-5",
  "agent": "Researcher",
  "content": "Base TVL has...",
  "usage": { "inputTokens": 4120, "outputTokens": 880, "creditsSpent": 0.0489, "creditsRemaining": 24.95 }
}`}</pre>

            <h3>Example: github</h3>
            <pre className="legal-pre">{`curl https://aeroagents.io/v1/github \\
  -H "Authorization: Bearer sk_aero_..." \\
  -H "Content-Type: application/json" \\
  -d '{"repo_url":"https://github.com/owner/repo","model":"deepseek-v4-flash"}'`}</pre>
            <p>Response: a structured <C>verdict</C> object (verdict, confidence, code quality, AI-slop signals, security, activity) plus the usual <C>usage</C> block.</p>

            <h3>Example: legitimacy</h3>
            <pre className="legal-pre">{`curl https://aeroagents.io/v1/legitimacy \\
  -H "Authorization: Bearer sk_aero_..." \\
  -H "Content-Type: application/json" \\
  -d '{"project_url":"https://example.xyz","model":"claude-sonnet-4-6"}'`}</pre>
            <p>Returns a markdown <C>report</C> (the verdict) plus <C>usage</C>.</p>

            <h3>Example: docs</h3>
            <pre className="legal-pre">{`curl https://aeroagents.io/v1/docs \\
  -H "Authorization: Bearer sk_aero_..." \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://docs.example.com","model":"llama-3.3-70b"}'`}</pre>
            <p>Returns a structured <C>report</C> (verdict, slop score, TL;DR, tech stack, socials) plus <C>usage</C>.</p>

            <h3>Example: slop scan</h3>
            <pre className="legal-pre">{`curl https://aeroagents.io/v1/slop \\
  -H "Authorization: Bearer sk_aero_..." \\
  -H "Content-Type: application/json" \\
  -d '{"text":"This revolutionary, game-changing tool is fast, simple, and powerful."}'`}</pre>

            <h3>Choosing a model</h3>
            <p>Every endpoint that uses an LLM takes an optional <C>model</C> field. Pass any id from <C>/v1/models</C> to pick it; omit the field and the default model is used. A model id that does not exist returns <C>400</C>. Pure-analysis endpoints like <C>/v1/slop</C> take no model.</p>

            <h3>Errors</h3>
            <ul>
              <li><C>401</C> missing, malformed, or revoked key.</li>
              <li><C>402</C> API wallet out of credits, top up with VVV to continue.</li>
              <li><C>400</C> bad request (unknown model, missing fields).</li>
              <li><C>422</C> the input could not be processed (for example a bad video URL).</li>
            </ul>
          </div>

          {/* Rate Limits */}
          <div id="rate-limits" className="legal-section">
            <h2>Rate Limits</h2>
            <p>aero doesn&apos;t cap usage per hour or per day. This applies to <B>every model and every feature</B> - chat, agents, teams, web and Telegram - no exceptions. Your wallet balance is the only throttle: you pay per token, and every feature stops if you hit zero.</p>
            <p>Credit-level protection: every chat request is billed only after the response streams back. Failed or aborted requests cost nothing. A <B>&quot;failed request&quot;</B> means a network error before the model replied, a provider 5xx/timeout before any tokens arrived, or you clicking Stop before the first token. If the model started replying and then cut off mid-stream, you&apos;re only billed for what you actually received.</p>
          </div>

          {/* Troubleshooting */}
          <div id="troubleshooting" className="legal-section">
            <h2>Troubleshooting</h2>
            <p>Common things that go sideways and how to recover. If none of this helps, email us at <a href="mailto:team@aeroagents.io">team@aeroagents.io</a> and we&apos;ll take a look.</p>
            <h3>Wallet won&apos;t connect</h3>
            <ul>
              <li>aero only supports <B>MetaMask</B> today. Make sure the MetaMask extension is installed and unlocked before clicking Connect.</li>
              <li>On mobile, open aero inside the <B>MetaMask mobile app</B>&apos;s built-in browser - a normal mobile browser can&apos;t talk to the extension.</li>
              <li>If the signature prompt never appears, check that pop-ups aren&apos;t blocked.</li>
              <li>Make sure your wallet is on the <B>Base</B> network - top-ups happen on Base and the wrong chain will make the transaction fail.</li>
            </ul>
            <h3>&quot;Insufficient credits&quot; when sending a message</h3>
            <ul>
              <li>Your balance dropped below the estimated cost of the next reply. Top up from the Credits panel.</li>
              <li>Expensive models (Opus, GPT-5) burn credits faster than cheap ones - switch model in the composer if you want to stretch a balance.</li>
              <li>Deposits on Base take a few seconds to confirm. If the balance hasn&apos;t moved after a minute, refresh the page.</li>
            </ul>
            <h3>Chat reply cuts off or errors out mid-stream</h3>
            <ul>
              <li>Usually a network blip or a provider rate limit on their end. Press retry or send the same message again - partial output isn&apos;t billed.</li>
              <li>If it keeps failing on the same model, try a different model: one provider may be degraded while the rest work fine.</li>
              <li>Very long replies can hit the model&apos;s output cap. Ask it to continue or break the task into smaller prompts.</li>
            </ul>
          </div>

          {/* FAQ */}
          <div id="faq" className="legal-section">
            <h2>FAQ</h2>
            {FAQ.map(([q, a]) => (
              <div key={q} className="docs-faq-item">
                <p className="docs-faq-q">{q}</p>
                <p className="docs-faq-a">{a}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="legal-foot">
            <span className="legal-foot-brand">aero</span>
            <div className="legal-foot-links">
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
              <a href="mailto:team@aeroagents.io">team@aeroagents.io</a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
