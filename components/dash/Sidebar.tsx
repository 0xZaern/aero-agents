'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useChatStore } from '@/lib/dash/stores/chatStore';
import { useAuthStore } from '@/lib/dash/stores/authStore';
import { useScheduledTasksStore } from '@/lib/dash/stores/scheduledTasksStore';
import { getConversations, deleteConversation, updateConversation } from '@/lib/dash/api';
import { listFolders, createFolder, deleteFolder, moveConversation, pinConversation } from '@/lib/dash/foldersApi';
import type { Conversation } from '@/lib/dash/types';

function Ic({ d, s = 14 }: { d: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const I = {
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  pin: 'M12 17v5|M9 10.76V4h6v6.76l2 3.24H7z',
  bot: 'M12 8V4H8|M4 12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z|M2 14h2|M20 14h2|M15 13v2|M9 13v2',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 7a4 4 0 1 0 0 0|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75',
  clock: 'M12 6v6l4 2|M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
  dollar: 'M12 1v22|M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  sun: 'M12 1v2|M12 21v2|M4.2 4.2l1.4 1.4|M18.4 18.4l1.4 1.4|M1 12h2|M21 12h2|M4.2 19.8l1.4-1.4|M18.4 5.6l1.4-1.4|M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9',
  search: 'M21 21l-4.35-4.35',
};

interface CtxMenu { conv: Conversation; x: number; y: number; }

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [ctx, setCtx] = useState<CtxMenu | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const folderInputRef = useRef<HTMLInputElement>(null);

  const conversations = useChatStore((s) => s.conversations);
  const setConversations = useChatStore((s) => s.setConversations);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const setCurrentConversation = useChatStore((s) => s.setCurrentConversation);
  const removeConversation = useChatStore((s) => s.removeConversation);
  const updateConversationLocal = useChatStore((s) => s.updateConversation);
  const togglePinLocal = useChatStore((s) => s.togglePin);
  const moveConversationLocal = useChatStore((s) => s.moveConversation);
  const setMessages = useChatStore((s) => s.setMessages);
  const folders = useChatStore((s) => s.folders);
  const setFolders = useChatStore((s) => s.setFolders);
  const addFolder = useChatStore((s) => s.addFolder);
  const removeFolder = useChatStore((s) => s.removeFolder);
  const collapsedFolderIds = useChatStore((s) => s.collapsedFolderIds);
  const toggleFolderCollapsed = useChatStore((s) => s.toggleFolderCollapsed);

  const tasks = useScheduledTasksStore((s) => s.tasks);
  const fetchTasks = useScheduledTasksStore((s) => s.fetchAll);

  const user = useAuthStore((s) => s.user);
  const onChat = pathname === '/dashboard/chat';

  useEffect(() => {
    getConversations().then(setConversations).catch(() => {});
    listFolders().then(setFolders).catch(() => {});
    fetchTasks().catch(() => {});
  }, [setConversations, setFolders, fetchTasks]);

  useEffect(() => { if (newFolderOpen) folderInputRef.current?.focus(); }, [newFolderOpen]);
  useEffect(() => {
    const close = () => setCtx(null);
    if (ctx) { window.addEventListener('click', close); window.addEventListener('scroll', close, true); }
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, [ctx]);

  const q = query.trim().toLowerCase();
  const match = (c: Conversation) => !q || (c.title || 'untitled').toLowerCase().includes(q);
  const byRecent = (a: Conversation, b: Conversation) =>
    new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();

  const pinned = useMemo(() => conversations.filter((c) => c.isPinned && match(c)).sort(byRecent), [conversations, q]);
  const ungrouped = useMemo(
    () => conversations.filter((c) => !c.isPinned && !c.folderId && match(c)).sort(byRecent),
    [conversations, q]
  );
  const folderChats = (fid: string) => conversations.filter((c) => !c.isPinned && c.folderId === fid && match(c)).sort(byRecent);

  function newSession() {
    setCurrentConversation(null); setMessages([]); router.push('/dashboard/chat');
  }
  function openSession(id: string) { setCurrentConversation(id); router.push('/dashboard/chat'); }
  function openTask(convId: string | null) { if (convId) openSession(convId); }

  async function submitNewFolder() {
    const name = newFolderName.trim();
    if (name) { try { addFolder(await createFolder(name)); } catch {} }
    setNewFolderName(''); setNewFolderOpen(false);
  }
  async function delFolder(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try { await deleteFolder(id); removeFolder(id); } catch {}
  }

  /* context-menu actions */
  async function doPin(c: Conversation) {
    setCtx(null); togglePinLocal(c.id);
    try { await pinConversation(c.id, !c.isPinned); } catch { togglePinLocal(c.id); }
  }
  async function doMove(c: Conversation, folderId: string | null) {
    setCtx(null); const prev = c.folderId ?? null; moveConversationLocal(c.id, folderId);
    try { await moveConversation(c.id, folderId); } catch { moveConversationLocal(c.id, prev); }
  }
  function startRename(c: Conversation) { setCtx(null); setRenamingId(c.id); setRenameVal(c.title || ''); }
  async function commitRename(id: string) {
    const t = renameVal.trim(); setRenamingId(null);
    if (!t) return; updateConversationLocal(id, { title: t });
    try { await updateConversation(id, { title: t }); } catch {}
  }
  async function doDelete(c: Conversation) {
    setCtx(null);
    try { await deleteConversation(c.id); removeConversation(c.id); if (currentConversationId === c.id) { setCurrentConversation(null); setMessages([]); } } catch {}
  }

  const short = user?.walletAddress ? `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}` : 'guest';

  function ChatRow({ c }: { c: Conversation }) {
    const active = onChat && c.id === currentConversationId;
    if (renamingId === c.id) {
      return (
        <div style={{ padding: '2px 8px' }}>
          <input
            autoFocus className="term-inline-input" value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(c.id); if (e.key === 'Escape') setRenamingId(null); }}
            onBlur={() => commitRename(c.id)}
          />
        </div>
      );
    }
    return (
      <button
        onClick={() => openSession(c.id)}
        onContextMenu={(e) => { e.preventDefault(); setCtx({ conv: c, x: e.clientX, y: e.clientY }); }}
        className={`term-nav-item${active ? ' active' : ''}`}
        style={{ justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', gap: 8, minWidth: 0, overflow: 'hidden', alignItems: 'center' }}>
          {c.isPinned && <span style={{ color: 'var(--t-accent)', flexShrink: 0 }}><Ic d={I.pin} s={11} /></span>}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || 'untitled'}</span>
        </span>
        <span className="x" onClick={(e) => { e.stopPropagation(); setCtx({ conv: c, x: e.clientX, y: e.clientY }); }} title="actions">⋯</span>
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* new chat */}
      <div style={{ padding: '12px 12px 8px' }}>
        <button className="term-btn primary" style={{ width: '100%' }} onClick={newSession}>+ new session</button>
      </div>
      {/* search */}
      <div className="term-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search conversations" />
      </div>

      {/* scrollable list */}
      <div className="term-scroll" style={{ flex: 1, padding: '4px 10px 10px' }}>
        {/* scheduled */}
        {tasks.length > 0 && (
          <div>
            <div className="term-nav-group-label">scheduled</div>
            {tasks.filter((t) => !q || t.title.toLowerCase().includes(q)).map((t) => (
              <button key={t.id} className="term-nav-item" style={{ justifyContent: 'space-between' }} onClick={() => openTask(t.conversation_id)}>
                <span style={{ display: 'flex', gap: 8, minWidth: 0, overflow: 'hidden', alignItems: 'center' }}>
                  <span style={{ color: 'var(--t-accent)', flexShrink: 0 }}><Ic d={I.clock} s={12} /></span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                </span>
                <span className={`pill ${t.status}`} style={{ padding: '1px 7px', fontSize: 9 }}>{t.status}</span>
              </button>
            ))}
          </div>
        )}

        {/* pinned */}
        {pinned.length > 0 && (
          <div>
            <div className="term-nav-group-label">pinned</div>
            {pinned.map((c) => <ChatRow key={c.id} c={c} />)}
          </div>
        )}

        {/* folders */}
        <div className="term-nav-group-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>folders</span>
          <button onClick={() => setNewFolderOpen((v) => !v)} title="new folder" style={{ color: 'var(--t-dim)', fontSize: 14, lineHeight: 1 }}>+</button>
        </div>
        {newFolderOpen && (
          <div style={{ padding: '2px 8px 6px' }}>
            <input
              ref={folderInputRef} className="term-inline-input" value={newFolderName} placeholder="folder name…"
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitNewFolder(); if (e.key === 'Escape') setNewFolderOpen(false); }}
              onBlur={submitNewFolder}
            />
          </div>
        )}
        {folders.length === 0 && !newFolderOpen && (
          <div className="mono" style={{ padding: '2px 11px 4px', color: 'var(--t-dim)', fontSize: 11 }}>no folders</div>
        )}
        {folders.map((f) => {
          const collapsed = collapsedFolderIds.has(f.id);
          const chats = folderChats(f.id);
          return (
            <div key={f.id}>
              <button className="term-nav-item" style={{ justifyContent: 'space-between' }} onClick={() => toggleFolderCollapsed(f.id)}>
                <span style={{ display: 'flex', gap: 8, minWidth: 0, overflow: 'hidden', alignItems: 'center' }}>
                  <span className="caret" style={{ width: 10 }}>{collapsed ? '▸' : '▾'}</span>
                  <span style={{ color: 'var(--t-muted)', flexShrink: 0 }}><Ic d={I.folder} s={13} /></span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--t-dim)', fontSize: 11 }}>{chats.length || ''}</span>
                  <span className="x" onClick={(e) => delFolder(f.id, e)} title="delete folder">✕</span>
                </span>
              </button>
              {!collapsed && (
                <div style={{ marginLeft: 10 }}>
                  {chats.length === 0 ? (
                    <div className="mono" style={{ padding: '2px 11px', color: 'var(--t-dim)', fontSize: 10.5 }}>empty</div>
                  ) : chats.map((c) => <ChatRow key={c.id} c={c} />)}
                </div>
              )}
            </div>
          );
        })}

        {/* loose chats */}
        <div className="term-nav-group-label">chats</div>
        {ungrouped.length === 0 ? (
          <div className="mono" style={{ padding: '2px 11px', color: 'var(--t-dim)', fontSize: 11 }}>
            {q ? 'no matches' : 'no sessions yet'}
          </div>
        ) : ungrouped.map((c) => <ChatRow key={c.id} c={c} />)}
      </div>

      {/* footer */}
      <div className="term-userbar">
        <div className="who">
          <div className="addr">{short}</div>
          <div className="sub">{user?.plan === 'pro' ? 'pro plan' : 'basic plan'} · ${(user?.credits ?? 0).toFixed(2)}</div>
        </div>
      </div>

      {/* context menu */}
      {ctx && (
        <div className="term-menu" style={{ position: 'fixed', top: Math.min(ctx.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 260), left: Math.min(ctx.x, 200), bottom: 'auto', right: 'auto' }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => doPin(ctx.conv)}><Ic d={I.pin} /> {ctx.conv.isPinned ? 'unpin' : 'pin'}</button>
          <button onClick={() => startRename(ctx.conv)}><Ic d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7|M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /> rename</button>
          <div className="sep" />
          <div className="mono" style={{ padding: '4px 11px 2px', color: 'var(--t-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>move to</div>
          {ctx.conv.folderId && <button onClick={() => doMove(ctx.conv, null)}><Ic d={I.folder} /> remove from folder</button>}
          {folders.filter((f) => f.id !== ctx.conv.folderId).map((f) => (
            <button key={f.id} onClick={() => doMove(ctx.conv, f.id)}><Ic d={I.folder} /> {f.name}</button>
          ))}
          {folders.length === 0 && <div className="mono" style={{ padding: '2px 11px 4px', color: 'var(--t-dim)', fontSize: 11 }}>no folders</div>}
          <div className="sep" />
          <button onClick={() => doDelete(ctx.conv)} style={{ color: '#f87171' }}><Ic d="M3 6h18|M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /> delete</button>
        </div>
      )}
    </div>
  );
}
