'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Agent } from '@/lib/dash/types';
import {
  getAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  cloneAgent,
} from '@/lib/dash/api';
import { useChatStore } from '@/lib/dash/stores/chatStore';
import { useAuthStore } from '@/lib/dash/stores/authStore';
import { truncate } from '@/lib/dash/utils';
import { AgentEditor } from '@/components/dash/agents/AgentEditor';
import { AGENT_CONSOLE_ROUTE as ANALYZER_ROUTE } from '@/lib/dash/agentConsoles';

type Tab = 'presets' | 'my' | 'community';

// Tool display labels
const TOOL_LABEL: Record<string, string> = {
  web_search: 'web',
  url_reader: 'url',
  code_executor: 'code',
  image_generator: 'img',
};

export default function AgentsPage() {
  const router = useRouter();
  const selectAgent = useChatStore((s) => s.selectAgent);
  const setSelectedCrewId = useChatStore((s) => s.setSelectedCrewId);
  const setCurrentConversation = useChatStore((s) => s.setCurrentConversation);
  const setChatMessages = useChatStore((s) => s.setMessages);

  const isPro = useAuthStore((s) => s.isPro());
  const [tab, setTab] = useState<Tab>('presets');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);

  // Run an agent → open a fresh chat with it selected (or its console for analyzers).
  const runAgent = useCallback((agent: Agent) => {
    if (!isPro) { router.push('/dashboard/billing'); return; } // locked on basic
    const console = ANALYZER_ROUTE[agent.name];
    if (console) { router.push(console); return; }
    setSelectedCrewId(null);
    selectAgent(agent.id, agent.modelId);
    setCurrentConversation(null);
    setChatMessages([]);
    router.push('/dashboard/chat');
  }, [isPro, router, selectAgent, setSelectedCrewId, setCurrentConversation, setChatMessages]);

  // Editor state: null editor = closed, agent=null = new
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadAgents = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      const data = await getAgents(t);
      setAgents(data);
    } catch {
      // toast from request()
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents(tab);
  }, [tab, loadAgents]);

  function openNew() {
    if (!isPro) { router.push('/dashboard/billing'); return; } // locked on basic
    setEditingAgent(null);
    setEditorOpen(true);
  }

  function openEdit(agent: Agent) {
    if (!isPro) { router.push('/dashboard/billing'); return; } // locked on basic
    setEditingAgent(agent);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingAgent(null);
  }

  async function handleSave(data: Omit<Agent, 'id' | 'isPreset'>) {
    setIsSaving(true);
    try {
      if (editingAgent?.id && !editingAgent.isPreset) {
        // update existing
        const updated = await updateAgent(editingAgent.id, data as Partial<Agent>);
        setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } else if (!editingAgent) {
        // create new
        const created = await createAgent(data);
        if (tab === 'my') {
          setAgents((prev) => [...prev, created]);
        } else {
          // switch to "my" tab to show it
          setTab('my');
        }
      }
      closeEditor();
    } catch {
      // toast from request()
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingAgent?.id) return;
    try {
      await deleteAgent(editingAgent.id);
      setAgents((prev) => prev.filter((a) => a.id !== editingAgent.id));
      closeEditor();
    } catch {
      // toast from request()
    }
  }

  async function handleClone(agent: Agent, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await cloneAgent(agent.id);
      setTab('my');
    } catch {
      // toast from request()
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'presets', label: 'presets' },
    { id: 'my', label: 'my agents' },
    { id: 'community', label: 'marketplace' },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div
        style={{
          borderBottom: '1px solid var(--border)',
          padding: '0 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          height: 38,
          flexShrink: 0,
        }}
      >
        {/* Tab buttons */}
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '0 14px',
              height: '100%',
              fontSize: 11,
              color: tab === t.id ? 'var(--text)' : 'var(--text-dim)',
              borderBottom: tab === t.id ? '1px solid var(--text)' : '1px solid transparent',
              letterSpacing: '0.04em',
              transition: 'color 0.12s, border-color 0.12s',
            }}
          >
            {t.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* New agent button - only shown on "my" tab */}
        {tab === 'my' && (
          <button className="term-btn" style={{ fontSize: 11, padding: '4px 11px' }} onClick={openNew}>
            + new agent
          </button>
        )}
      </div>

      {/* Grid area */}
      <div className="term-scroll">
        <div className="term-pad">
          {!isPro && (
            <div className="term-panel" style={{ marginBottom: 14 }}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--text-muted)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span style={{ flex: 1 }}>agents are a PRO feature on the basic plan - browse them here, upgrade to use them.</span>
                <button className="term-btn primary" style={{ fontSize: 11, padding: '4px 11px' }} onClick={() => router.push('/dashboard/billing')}>upgrade to pro</button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="term-empty" style={{ height: 200 }}>
              <div className="big">
                loading<span className="term-caret" />
              </div>
            </div>
          ) : agents.length === 0 ? (
            <div className="term-empty" style={{ height: 280 }}>
              <div className="big">
                {tab === 'my'
                  ? '> no agents yet'
                  : tab === 'community'
                  ? '> no marketplace agents'
                  : '> no presets'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {tab === 'my' ? (
                  <>
                    create your first agent with the{' '}
                    <button
                      style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: 2 }}
                      onClick={openNew}
                    >
                      + new agent
                    </button>{' '}
                    button
                  </>
                ) : (
                  'nothing here yet'
                )}
              </div>
            </div>
          ) : (
            <div className="term-grid">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  tab={tab}
                  locked={!isPro}
                  onConfigure={() => openEdit(agent)}
                  onRun={() => runAgent(agent)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor overlay */}
      {editorOpen && (
        <AgentEditor
          agent={editingAgent}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={closeEditor}
          isSaving={isSaving}
          onUpdated={(a) => {
            setAgents((prev) => prev.map((x) => (x.id === a.id ? a : x)));
            setEditingAgent(a);
          }}
        />
      )}
    </div>
  );
}

/* ─── Agent Card ─────────────────────────────────────────────────────────── */

interface AgentCardProps {
  agent: Agent;
  tab: Tab;
  locked?: boolean;
  onConfigure: () => void;
  onRun: () => void;
}

function IconBtn({ d, title, onClick }: { d: string; title: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className="term-btn ghost"
      style={{ padding: 6, lineHeight: 0 }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {d.split('|').map((p, i) => <path key={i} d={p} />)}
      </svg>
    </button>
  );
}

const PLAY = 'M6 4l14 8-14 8z';
const GEAR = 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z';

function AgentCard({ agent, tab, locked, onConfigure, onRun }: AgentCardProps) {
  const isAnalyzer = !!ANALYZER_ROUTE[agent.name];
  return (
    <div
      className="term-card"
      onClick={onRun}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onRun()}
      style={{ cursor: 'pointer', opacity: locked ? 0.72 : 1 }}
    >
      {/* header row - name + run/settings icons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div className="title" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agent.name}
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
          {locked ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, letterSpacing: '0.04em', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
              Only PRO
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
          ) : (
            <>
              <IconBtn d={PLAY} title={isAnalyzer ? 'open console' : 'run - new chat with agent'} onClick={onRun} />
              <IconBtn d={GEAR} title="configure" onClick={onConfigure} />
            </>
          )}
        </div>
      </div>

      {/* role */}
      {agent.role && (
        <div className="meta" style={{ marginBottom: 2 }}>
          {truncate(agent.role, 60)}
        </div>
      )}

      {/* model */}
      <div className="meta" style={{ marginBottom: agent.publicDescription || agent.goal ? 8 : 0 }}>
        model: {agent.modelId}
      </div>

      {/* public description or goal snippet */}
      {(agent.publicDescription || agent.goal) && (
        <div className="desc">
          {truncate(agent.publicDescription || agent.goal || '', 100)}
        </div>
      )}

      {/* tools */}
      {agent.tools.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
          {agent.tools.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--t-dim)',
                border: '1px solid var(--t-border)',
                borderRadius: 4,
                padding: '1px 5px',
              }}
            >
              {TOOL_LABEL[t] ?? t}
            </span>
          ))}
        </div>
      )}

      {/* author for marketplace tab */}
      {tab === 'community' && agent.authorDisplayName && (
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--t-dim)' }}>
          by {agent.authorDisplayName}
        </div>
      )}
    </div>
  );
}
