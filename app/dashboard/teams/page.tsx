'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createCrew,
  deleteCrew,
  getAgents,
  getCrews,
  updateCrew,
} from '@/lib/dash/api';
import type { Agent, Crew } from '@/lib/dash/types';
import { useAuthStore } from '@/lib/dash/stores/authStore';
import CrewEditorDrawer from '@/components/dash/crews/CrewEditorDrawer';
import RunPanel from '@/components/dash/crews/RunPanel';
import ExecHistory from '@/components/dash/crews/ExecHistory';

type ActivePanel = 'editor' | 'run' | null;

const PLAY = 'M6 4l14 8-14 8z';
const GEAR = 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z';
const TRASH = 'M3 6h18|M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2';

function IconBtn({ d, title, onClick }: { d: string; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="term-btn ghost"
      style={{ padding: 6, lineHeight: 0 }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {d.split('|').map((p, i) => <path key={i} d={p} />)}
      </svg>
    </button>
  );
}

export default function TeamsPage() {
  const router = useRouter();
  const isPro = useAuthStore((s) => s.isPro());
  const [crews, setCrews] = useState<Crew[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [crewsLoading, setCrewsLoading] = useState(true);
  const [agentsLoading, setAgentsLoading] = useState(true);

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null);
  const [runningCrew, setRunningCrew] = useState<Crew | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const loadCrews = useCallback(async () => {
    setCrewsLoading(true);
    try { setCrews(await getCrews()); } catch { /* toast */ } finally { setCrewsLoading(false); }
  }, []);

  const loadAgents = useCallback(async () => {
    setAgentsLoading(true);
    try {
      const [mine, presets] = await Promise.all([getAgents('my'), getAgents('presets')]);
      const map = new Map<string, Agent>();
      for (const a of [...mine, ...presets]) map.set(a.id, a);
      setAgents(Array.from(map.values()));
    } catch { /* toast */ } finally { setAgentsLoading(false); }
  }, []);

  useEffect(() => { void loadCrews(); void loadAgents(); }, [loadCrews, loadAgents]);

  function openNew() { if (!isPro) { router.push('/dashboard/billing'); return; } setEditingCrew(null); setActivePanel('editor'); }
  function openEdit(crew: Crew) { if (!isPro) { router.push('/dashboard/billing'); return; } setEditingCrew(crew); setActivePanel('editor'); }
  function openRun(crew: Crew) { if (!isPro) { router.push('/dashboard/billing'); return; } setRunningCrew(crew); setActivePanel('run'); }
  function closePanel() { setActivePanel(null); setEditingCrew(null); setRunningCrew(null); }

  async function handleSave(data: Omit<Crew, 'id' | 'isPreset'>) {
    if (editingCrew) {
      const updated = await updateCrew(editingCrew.id, data);
      setCrews((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } else {
      const created = await createCrew(data);
      setCrews((prev) => [...prev, created]);
    }
    closePanel();
  }

  async function handleDelete(crew: Crew) {
    if (!window.confirm(`delete "${crew.name}"? this cannot be undone.`)) return;
    try { await deleteCrew(crew.id); setCrews((prev) => prev.filter((c) => c.id !== crew.id)); } catch { /* toast */ }
  }

  const myCrews = crews.filter((c) => !c.isPreset);
  const presetCrews = crews.filter((c) => c.isPreset);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="term-scroll" style={{ flex: 1 }}>
        <div className="term-pad" style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 1120, margin: '0 auto' }}>

          {!isPro && (
            <div className="term-panel" style={{ marginBottom: 14 }}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--text-muted)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span style={{ flex: 1 }}>teams are a PRO feature on the basic plan - browse them here, upgrade to use them.</span>
                <button className="term-btn primary" style={{ fontSize: 11, padding: '4px 11px' }} onClick={() => router.push('/dashboard/billing')}>upgrade to pro</button>
              </div>
            </div>
          )}

          {/* top bar: just the action (location lives in the header) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button className="term-btn primary" onClick={openNew}>+ new team</button>
          </div>

          {crewsLoading ? (
            <div className="term-empty" style={{ height: 200 }}>
              <div className="big">loading<span className="term-caret" /></div>
            </div>
          ) : crews.length === 0 ? (
            <div className="term-empty" style={{ height: 280 }}>
              <div className="big">&gt; no teams yet</div>
              <div style={{ fontSize: 12, color: 'var(--t-dim)' }}>a team chains agents together on a multi-stage task</div>
              <button className="term-btn" style={{ marginTop: 6 }} onClick={openNew}>+ new team</button>
            </div>
          ) : (
            <>
              {myCrews.length > 0 && (
                <>
                  <div className="term-nav-group-label" style={{ padding: '4px 0 8px' }}>my teams</div>
                  <div className="term-grid" style={{ marginBottom: 22 }}>
                    {myCrews.map((crew) => (
                      <TeamCard key={crew.id} crew={crew} agents={agents} locked={!isPro}
                        onRun={() => openRun(crew)} onEdit={() => openEdit(crew)} onDelete={() => void handleDelete(crew)} />
                    ))}
                  </div>
                </>
              )}

              {presetCrews.length > 0 && (
                <>
                  <div className="term-nav-group-label" style={{ padding: '4px 0 8px' }}>preset teams</div>
                  <div className="term-grid" style={{ marginBottom: 22 }}>
                    {presetCrews.map((crew) => (
                      <TeamCard key={crew.id} crew={crew} agents={agents} locked={!isPro} onRun={() => openRun(crew)} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* execution history */}
          <ExecHistory refreshKey={historyKey} crews={crews.map((c) => ({ id: c.id, name: c.name }))} />
        </div>
      </div>

      {activePanel === 'editor' && (
        <CrewEditorDrawer crew={editingCrew} agents={agentsLoading ? [] : agents} onSave={handleSave} onClose={closePanel} />
      )}
      {activePanel === 'run' && runningCrew && (
        <RunPanel crew={runningCrew} onClose={closePanel} onDone={() => setHistoryKey((k) => k + 1)} />
      )}
    </div>
  );
}

// ── Team card - matches the agent card style ────────────────────────────────

interface TeamCardProps {
  crew: Crew;
  agents: Agent[];
  locked?: boolean;
  onRun: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function TeamCard({ crew, agents, locked, onRun, onEdit, onDelete }: TeamCardProps) {
  const names = crew.agentIds.map((id) => agents.find((a) => a.id === id)?.name ?? id.slice(0, 8));

  return (
    <div className="term-card" onClick={onRun} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onRun()} style={{ cursor: 'pointer', opacity: locked ? 0.72 : 1 }}>
      {/* header: name + run/settings/delete icons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div className="title" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{crew.name}</div>
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
              <IconBtn d={PLAY} title="run team" onClick={onRun} />
              {onEdit && <IconBtn d={GEAR} title="configure" onClick={onEdit} />}
              {onDelete && <IconBtn d={TRASH} title="delete" onClick={onDelete} />}
            </>
          )}
        </div>
      </div>

      {/* meta */}
      <div className="meta" style={{ marginBottom: crew.description ? 8 : 6 }}>
        {crew.processType} · {crew.agentIds.length} agent{crew.agentIds.length !== 1 ? 's' : ''}
      </div>

      {/* description */}
      {crew.description && <div className="desc">{crew.description}</div>}

      {/* pipeline */}
      {names.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginTop: 10 }}>
          {names.map((name, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, padding: '2px 7px', background: 'var(--t-bg)', border: '1px solid var(--t-border)', borderRadius: 5, color: 'var(--t-muted)', fontFamily: 'var(--font-m)' }}>{name}</span>
              {i < names.length - 1 && <span style={{ fontSize: 11, color: 'var(--t-accent)' }}>→</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
