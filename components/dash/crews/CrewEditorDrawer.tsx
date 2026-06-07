'use client';

import { useEffect, useRef, useState } from 'react';
import type { Agent, Crew } from '@/lib/dash/types';

type CrewFormState = {
  name: string;
  description: string;
  processType: 'sequential' | 'hierarchical';
  agentIds: string[];
};

const DEFAULT_FORM: CrewFormState = {
  name: '',
  description: '',
  processType: 'sequential',
  agentIds: [],
};

interface CrewEditorDrawerProps {
  crew: Crew | null;
  agents: Agent[];
  onSave: (data: Omit<Crew, 'id' | 'isPreset'>) => Promise<void>;
  onClose: () => void;
}

export default function CrewEditorDrawer({ crew, agents, onSave, onClose }: CrewEditorDrawerProps) {
  const [form, setForm] = useState<CrewFormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof CrewFormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Populate form when editing an existing crew
  useEffect(() => {
    if (crew) {
      setForm({
        name: crew.name,
        description: crew.description ?? '',
        processType: crew.processType,
        agentIds: [...crew.agentIds],
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setErrors({});
    setTimeout(() => nameRef.current?.focus(), 60);
  }, [crew]);

  // Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'name required';
    if (form.agentIds.length === 0) next.agentIds = 'select at least one agent';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  function toggleAgent(id: string) {
    setForm((prev) => ({
      ...prev,
      agentIds: prev.agentIds.includes(id)
        ? prev.agentIds.filter((a) => a !== id)
        : [...prev.agentIds, id],
    }));
    // Clear agentIds error when a selection is made
    if (errors.agentIds) setErrors((prev) => ({ ...prev, agentIds: undefined }));
  }

  const myAgents = agents.filter((a) => !a.isPreset);
  const presetAgents = agents.filter((a) => a.isPreset);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(0,0,0,0.55)',
        }}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={crew ? 'edit team' : 'new team'}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100%',
          width: 340,
          zIndex: 50,
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border-strong)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {/* Header */}
        <div
          className="term-panel-head"
          style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border-strong)' }}
        >
          <span>{crew ? '> edit team' : '> new team'}</span>
          <button
            className="term-btn ghost"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={onClose}
            aria-label="close drawer"
          >
            ✕
          </button>
        </div>

        {/* Form body */}
        <div className="term-scroll" style={{ flex: 1 }}>
          <div className="term-pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                name
              </label>
              <input
                ref={nameRef}
                className="term-input"
                value={form.name}
                onChange={(e) => {
                  setForm((p) => ({ ...p, name: e.target.value }));
                  if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
                }}
                placeholder="e.g. research-writer"
              />
              {errors.name && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>! {errors.name}</span>
              )}
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                description
              </label>
              <textarea
                className="term-textarea"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="what does this team accomplish?"
              />
            </div>

            {/* Process type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                process type
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['sequential', 'hierarchical'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setForm((p) => ({ ...p, processType: type }))}
                    className="term-btn"
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      fontSize: 11,
                      padding: '5px 10px',
                      ...(form.processType === type
                        ? { background: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)' }
                        : { background: 'transparent', color: 'var(--text-muted)', borderColor: 'var(--border)' }),
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {form.processType === 'sequential'
                  ? 'agents run one after another in order'
                  : 'a manager agent coordinates the others'}
              </span>
            </div>

            {/* Agents */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  agents
                </span>
                {form.agentIds.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {form.agentIds.length} selected
                  </span>
                )}
              </div>
              {errors.agentIds && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>! {errors.agentIds}</span>
              )}

              {agents.length === 0 ? (
                <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: '8px 0' }}>
                  no agents found. create agents first.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {myAgents.length > 0 && (
                    <>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '4px 0 2px' }}>
                        my agents
                      </div>
                      {myAgents.map((agent) => (
                        <AgentRow
                          key={agent.id}
                          agent={agent}
                          checked={form.agentIds.includes(agent.id)}
                          order={form.agentIds.indexOf(agent.id) + 1}
                          onToggle={() => toggleAgent(agent.id)}
                        />
                      ))}
                    </>
                  )}
                  {presetAgents.length > 0 && (
                    <>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '8px 0 2px' }}>
                        preset agents
                      </div>
                      {presetAgents.map((agent) => (
                        <AgentRow
                          key={agent.id}
                          agent={agent}
                          checked={form.agentIds.includes(agent.id)}
                          order={form.agentIds.indexOf(agent.id) + 1}
                          onToggle={() => toggleAgent(agent.id)}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button className="term-btn ghost" onClick={onClose} disabled={saving}>
            cancel
          </button>
          <button className="term-btn" onClick={handleSubmit} disabled={saving}>
            {saving ? 'saving…' : crew ? 'save changes' : 'create team'}
          </button>
        </div>
      </div>
    </>
  );
}

function AgentRow({
  agent,
  checked,
  order,
  onToggle,
}: {
  agent: Agent;
  checked: boolean;
  order: number;
  onToggle: () => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 10px',
        border: '1px solid',
        borderColor: checked ? 'var(--border-strong)' : 'var(--border)',
        background: checked ? 'var(--surface)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.12s, border-color 0.12s',
        borderRadius: 2,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ accentColor: 'var(--text)', width: 12, height: 12, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: checked ? 'var(--text)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agent.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agent.role}
        </div>
      </div>
      {checked && order > 0 && (
        <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
          #{order}
        </span>
      )}
    </label>
  );
}
