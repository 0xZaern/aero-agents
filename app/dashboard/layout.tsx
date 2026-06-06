'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/dash/stores/authStore';
import { useChatStore } from '@/lib/dash/stores/chatStore';
import { applySaved } from '@/lib/dash/customize';
import Sidebar from '@/components/dash/Sidebar';
import IconRail from '@/components/dash/IconRail';
import Toasts from '@/components/dash/Toasts';
import './dashboard.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const messages = useChatStore((s) => s.messages);

  // Export the open conversation as a markdown file.
  const exportChat = () => {
    if (messages.length === 0) return;
    const md = messages
      .map((m) => `## ${m.role === 'user' ? 'You' : m.modelId ?? 'assistant'}\n\n${m.content}`)
      .join('\n\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aero-chat-${currentConversationId ?? 'session'}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const isLogin = pathname === '/dashboard/login';

  // Wait for zustand-persist rehydration before deciding to redirect.
  useEffect(() => setMounted(true), []);

  // Re-apply saved theme overrides + background once the shell is mounted.
  useEffect(() => { if (mounted && isAuthenticated) applySaved(); }, [mounted, isAuthenticated]);

  useEffect(() => {
    if (mounted && !isAuthenticated && !isLogin) {
      router.replace('/dashboard/login');
    }
  }, [mounted, isAuthenticated, isLogin, router]);

  // Login page renders bare (no shell).
  if (isLogin) {
    return (
      <div className="term">
        {children}
        <Toasts />
      </div>
    );
  }

  // Pre-hydration / unauthenticated: show a minimal boot screen, no flicker.
  if (!mounted || !isAuthenticated) {
    return (
      <div className="term" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div className="mono" style={{ color: 'var(--t-dim)', fontSize: 13 }}>
          aero booting…<span className="term-caret" />
        </div>
      </div>
    );
  }

  const pageName = pathname.split('/')[2] || 'home';

  // Terminal-style location: ~/chat, and ~/chat/<slug> when a session is open.
  const slug = (s: string) =>
    s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'untitled';
  let locPath = `~/æro/${pageName}`;
  if (pageName === 'chat' && currentConversationId) {
    const conv = conversations.find((c) => c.id === currentConversationId);
    if (conv?.title) locPath += `/${slug(conv.title)}`;
  }

  return (
    <div className="term" data-lenis-prevent>
      <div className="term-shell" style={{ gridTemplateColumns: collapsed ? '58px 0px 1fr' : '58px 256px 1fr' }}>
        <aside className="term-rail">
          <IconRail />
        </aside>

        <div className="term-topbar">
          <button
            className="term-btn ghost"
            style={{ padding: '6px 8px' }}
            title={collapsed ? 'open sidebar' : 'close sidebar'}
            aria-label={collapsed ? 'open sidebar' : 'close sidebar'}
            onClick={() => setCollapsed((v) => !v)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed
                ? <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
                : <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />}
            </svg>
          </button>
          <span className="spacer" />
          <span className="path">{locPath}</span>
          <span className="spacer" />
          {pageName === 'chat' && messages.length > 0 && (
            <button
              type="button"
              className="term-btn ghost mono"
              style={{ padding: '6px 11px', fontSize: 12 }}
              title="Export chat as markdown"
              onClick={exportChat}
            >
              export
            </button>
          )}
        </div>

        <aside className="term-side">
          <Sidebar />
        </aside>

        <main className="term-main">{children}</main>
      </div>
      <Toasts />
    </div>
  );
}
