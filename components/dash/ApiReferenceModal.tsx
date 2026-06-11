'use client';

import { useEffect } from 'react';

interface ApiReferenceModalProps {
  onClose: () => void;
}

// Pre-block style reused from api/page.tsx quickstart panel.
const preStyle: React.CSSProperties = {
  fontFamily: 'var(--font-m)',
  fontSize: 11.5,
  lineHeight: 1.6,
  background: 'var(--t-bg-2)',
  padding: '12px 14px',
  borderRadius: 'var(--t-radius-sm)',
  overflowX: 'auto',
  margin: 0,
  color: 'var(--t-text)',
  whiteSpace: 'pre',
  width: '100%',
  boxSizing: 'border-box',
};

const sectionHeadStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--t-dim)',
  borderBottom: '1px solid var(--t-border)',
  paddingBottom: 6,
  marginBottom: 10,
};

const h3Style: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--t-muted)',
  margin: '16px 0 6px',
};

const bodyTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--t-muted)',
  lineHeight: 1.65,
  margin: '0 0 8px',
};

const codeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-m)',
  fontSize: 11.5,
  color: 'var(--t-accent)',
  background: 'var(--t-bg-2)',
  padding: '1px 5px',
  borderRadius: 'var(--t-radius-sm)',
};

const ENDPOINTS = [
  { method: 'GET',  path: '/v1/models',     desc: 'List callable models and their per-token pricing',            billing: 'free' },
  { method: 'POST', path: '/v1/chat',        desc: 'Chat completion across any model',                           billing: 'per-token' },
  { method: 'POST', path: '/v1/agent',       desc: 'Run a tool-using agent (researcher, coder, writer, analyst, critic, summarizer)', billing: 'per-token' },
  { method: 'POST', path: '/v1/youtube',     desc: 'Transcribe and summarize a YouTube video',                   billing: 'per-token' },
  { method: 'POST', path: '/v1/legitimacy',  desc: 'Legitimacy verdict on a crypto/web3 project URL',            billing: 'per-token' },
  { method: 'POST', path: '/v1/github',      desc: 'Analyze a public GitHub repository',                         billing: 'per-token' },
  { method: 'POST', path: '/v1/docs',        desc: 'Analyze a documentation/product website',                    billing: 'per-token' },
  { method: 'POST', path: '/v1/slop',        desc: 'AI-slop signal scan of text or code',                        billing: 'flat fee' },
];

export function ApiReferenceModal({ onClose }: ApiReferenceModalProps) {
  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape to close.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(0,0,0,0.55)',
        }}
      />

      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-ref-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 70,
          width: 860,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 48px)',
          background: 'var(--t-bg)',
          border: '1px solid var(--t-border)',
          borderRadius: 'var(--t-radius-sm)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <div
          className="term-panel-head"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}
        >
          <span id="api-ref-title">API reference</span>
          <button
            className="term-btn ghost"
            onClick={onClose}
            aria-label="Close API reference"
            style={{ padding: '1px 7px', fontSize: 14, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* scrollable body */}
        <div style={{ overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* intro */}
          <p style={sectionHeadStyle}>overview</p>
          <p style={bodyTextStyle}>
            aero has a public developer API. Mint a key, point any HTTP client at it, and call the same models and agents the web app uses from your own app, bot, or backend.
          </p>

          {/* get a key */}
          <h3 style={h3Style}>get a key</h3>
          <p style={bodyTextStyle}>
            Open <strong style={{ color: 'var(--t-text)' }}>Developer API</strong> on this page and click <strong style={{ color: 'var(--t-text)' }}>+ create key</strong>. The raw key is shown <strong style={{ color: 'var(--t-text)' }}>once</strong> at creation (format <code style={codeStyle}>sk_aero_...</code>) and only its hash is stored, so copy it immediately. You can mint several keys - they all share one balance. Revoking a key deletes it instantly.
          </p>

          {/* base URL and auth */}
          <h3 style={h3Style}>base URL and auth</h3>
          <p style={bodyTextStyle}>All endpoints live under <code style={codeStyle}>/v1</code>. Send the key as a Bearer token on every request:</p>
          <pre style={preStyle}>{`Base URL:  https://aeroagents.io/v1
Header:    Authorization: Bearer sk_aero_...`}</pre>

          {/* billing */}
          <h3 style={h3Style}>billing and the API wallet</h3>
          <p style={bodyTextStyle}>
            The API has its own credit wallet, separate from web-app credits. Top it up with <strong style={{ color: 'var(--t-text)' }}>VVV (Venice Token)</strong> on Base from the top-up panel on this page. Credits never expire and drain per call:
          </p>
          <ul style={{ margin: '0 0 8px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li style={{ fontSize: 12, color: 'var(--t-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--t-text)' }}>per-token</strong> for every endpoint that runs a model (<code style={codeStyle}>/v1/chat</code>, <code style={codeStyle}>/v1/agent</code>, and all agent endpoints): you pay the chosen model&apos;s token cost across the whole pipeline.
            </li>
            <li style={{ fontSize: 12, color: 'var(--t-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--t-text)' }}>flat fee</strong> for pure-analysis calls (<code style={codeStyle}>/v1/slop</code>): no model, a small fixed price.
            </li>
          </ul>
          <p style={{ ...bodyTextStyle, marginBottom: 0 }}>
            When the wallet hits zero, calls return <code style={codeStyle}>402</code> until you top up. The same key keeps working after a top-up.
          </p>

          {/* endpoints table */}
          <h3 style={h3Style}>endpoints</h3>
          <div className="term-table-wrap" style={{ marginBottom: 4 }}>
            <table className="term-table">
              <thead>
                <tr>
                  <th>method</th>
                  <th>path</th>
                  <th>description</th>
                  <th>billing</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((ep) => (
                  <tr key={ep.path}>
                    <td>
                      <span style={{
                        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em',
                        color: ep.method === 'GET' ? 'var(--t-dim)' : 'var(--t-accent)',
                        border: '1px solid var(--t-border-2)',
                        borderRadius: 4, padding: '1px 6px',
                      }}>{ep.method}</span>
                    </td>
                    <td><code style={{ fontFamily: 'var(--font-m)', fontSize: 11.5, color: 'var(--t-text)' }}>{ep.path}</code></td>
                    <td style={{ fontSize: 11.5, color: 'var(--t-muted)', lineHeight: 1.45 }}>{ep.desc}</td>
                    <td>
                      <span style={{
                        fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: ep.billing === 'free' ? 'var(--t-dim)' : ep.billing === 'flat fee' ? 'var(--t-muted)' : 'var(--t-accent)',
                        border: '1px solid var(--t-border-2)',
                        borderRadius: 'var(--t-radius-sm)', padding: '2px 7px',
                        whiteSpace: 'nowrap',
                      }}>{ep.billing}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* examples */}
          <h3 style={h3Style}>example: chat</h3>
          <pre style={preStyle}>{`curl https://aeroagents.io/v1/chat \\
  -H "Authorization: Bearer sk_aero_..." \\
  -H "Content-Type: application/json" \\
  -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"Hello"}]}'`}</pre>
          <p style={{ ...bodyTextStyle, marginTop: 8 }}>Response:</p>
          <pre style={preStyle}>{`{
  "model": "claude-sonnet-4-6",
  "content": "Hi! How can I help?",
  "usage": {
    "inputTokens": 9,
    "outputTokens": 7,
    "creditsSpent": 0.0001,
    "creditsRemaining": 24.99
  }
}`}</pre>

          <h3 style={h3Style}>example: agent</h3>
          <p style={bodyTextStyle}>
            Run a tool-using agent. <code style={codeStyle}>agent</code> is one of <code style={codeStyle}>researcher</code>, <code style={codeStyle}>coder</code>, <code style={codeStyle}>writer</code>, <code style={codeStyle}>analyst</code>, <code style={codeStyle}>critic</code>, <code style={codeStyle}>summarizer</code>. The agent uses its tools (web search, URL read, code exec) as needed and returns the final answer.
          </p>
          <pre style={preStyle}>{`curl https://aeroagents.io/v1/agent \\
  -H "Authorization: Bearer sk_aero_..." \\
  -H "Content-Type: application/json" \\
  -d '{"agent":"researcher","message":"Latest Base chain TVL trend","model":"claude-fable-5"}'`}</pre>
          <p style={{ ...bodyTextStyle, marginTop: 8 }}>Response:</p>
          <pre style={preStyle}>{`{
  "model": "claude-fable-5",
  "agent": "Researcher",
  "content": "Base TVL has...",
  "usage": { "inputTokens": 4120, "outputTokens": 880, "creditsSpent": 0.0489, "creditsRemaining": 24.95 }
}`}</pre>

          <h3 style={h3Style}>example: github</h3>
          <pre style={preStyle}>{`curl https://aeroagents.io/v1/github \\
  -H "Authorization: Bearer sk_aero_..." \\
  -H "Content-Type: application/json" \\
  -d '{"repo_url":"https://github.com/owner/repo","model":"deepseek-v4-flash"}'`}</pre>
          <p style={{ ...bodyTextStyle, marginTop: 8 }}>
            Response: a structured <code style={codeStyle}>verdict</code> object (verdict, confidence, code quality, AI-slop signals, security, activity) plus the usual <code style={codeStyle}>usage</code> block.
          </p>

          <h3 style={h3Style}>example: legitimacy</h3>
          <pre style={preStyle}>{`curl https://aeroagents.io/v1/legitimacy \\
  -H "Authorization: Bearer sk_aero_..." \\
  -H "Content-Type: application/json" \\
  -d '{"project_url":"https://example.xyz","model":"claude-sonnet-4-6"}'`}</pre>
          <p style={{ ...bodyTextStyle, marginTop: 8 }}>
            Returns a markdown <code style={codeStyle}>report</code> (the verdict) plus <code style={codeStyle}>usage</code>.
          </p>

          {/* choosing a model */}
          <h3 style={h3Style}>choosing a model</h3>
          <p style={bodyTextStyle}>
            Every endpoint that uses an LLM takes an optional <code style={codeStyle}>model</code> field. Pass any id from <code style={codeStyle}>/v1/models</code> to pick it; omit the field and the default model is used. A model id that does not exist returns <code style={codeStyle}>400</code>. Pure-analysis endpoints like <code style={codeStyle}>/v1/slop</code> take no model.
          </p>

          {/* errors */}
          <h3 style={h3Style}>errors</h3>
          <ul style={{ margin: '0 0 8px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              ['401', 'missing, malformed, or revoked key'],
              ['402', 'API wallet out of credits - top up with VVV to continue'],
              ['400', 'bad request (unknown model, missing fields)'],
              ['422', 'input could not be processed (e.g. bad video URL)'],
            ].map(([code, msg]) => (
              <li key={code} style={{ fontSize: 12, color: 'var(--t-muted)', lineHeight: 1.6 }}>
                <code style={codeStyle}>{code}</code> {msg}
              </li>
            ))}
          </ul>

        </div>
      </div>
    </>
  );
}
