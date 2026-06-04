// Dashboard theme customization - accent presets, per-token colour overrides,
// and a background image. Overrides are applied as inline CSS variables on the
// `.term` root element (which wins over the stylesheet's `.term { --t-*: … }`).
//
// Colour overrides are stored PER WALLET on the server (so they follow the user
// across devices). The background image stays device-local (it's a large data
// URL, not worth syncing).

import { useAuthStore } from './stores/authStore';
import { saveTheme } from './api';

const BG_KEY = 'aero.theme.bg';
const DEFAULT_MODEL_KEY = 'aero.defaultModel';

export interface CustomVar { name: string; label: string }
export const CUSTOM_VARS: CustomVar[] = [
  { name: '--t-accent', label: 'accent' },
  { name: '--t-bg', label: 'background' },
  { name: '--t-elev', label: 'surface' },
  { name: '--t-text', label: 'text' },
  { name: '--t-border', label: 'border' },
];

export interface Preset { id: string; label: string; accent: string; accentDim: string; accentSoft: string }
export const PRESETS: Preset[] = [
  { id: 'indigo', label: 'indigo', accent: '#6d8cff', accentDim: '#3c4a86', accentSoft: 'rgba(109,140,255,0.12)' },
  { id: 'emerald', label: 'emerald', accent: '#34d399', accentDim: '#1f7a5a', accentSoft: 'rgba(52,211,153,0.12)' },
  { id: 'amber', label: 'amber', accent: '#fbbf24', accentDim: '#8a6516', accentSoft: 'rgba(251,191,36,0.12)' },
  { id: 'rose', label: 'rose', accent: '#fb7185', accentDim: '#8a2f3d', accentSoft: 'rgba(251,113,133,0.12)' },
  { id: 'cyan', label: 'cyan', accent: '#22d3ee', accentDim: '#15788a', accentSoft: 'rgba(34,211,238,0.12)' },
  { id: 'mono', label: 'mono', accent: '#e7e9ec', accentDim: '#5d6478', accentSoft: 'rgba(231,233,236,0.10)' },
];

type Overrides = Record<string, string>;

function root(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector('.term');
}
function main(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector('.term-main');
}

export function getOverrides(): Overrides {
  const raw = useAuthStore.getState().user?.themeOverrides;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}
function save(o: Overrides) {
  const hasAny = Object.keys(o).length > 0;
  // Optimistic local update so the UI + applySaved() reflect it immediately…
  useAuthStore.getState().updateUser({ themeOverrides: hasAny ? JSON.stringify(o) : null });
  // …then persist per-wallet on the server (fire-and-forget; syncs across devices).
  saveTheme(hasAny ? (o as Record<string, string>) : null).catch(() => {});
}

function hexToSoft(hex: string, alpha = 0.12): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Set a single token override (persisted + applied). */
export function setVar(name: string, value: string) {
  const o = getOverrides();
  o[name] = value;
  delete o.__preset;
  root()?.style.setProperty(name, value);
  if (name === '--t-accent') {
    o['--t-accent-dim'] = value;
    o['--t-accent-soft'] = hexToSoft(value);
    root()?.style.setProperty('--t-accent-dim', value);
    root()?.style.setProperty('--t-accent-soft', hexToSoft(value));
  }
  save(o);
}

export function resetVar(name: string) {
  const o = getOverrides();
  delete o[name];
  root()?.style.removeProperty(name);
  if (name === '--t-accent') {
    delete o['--t-accent-dim']; delete o['--t-accent-soft'];
    root()?.style.removeProperty('--t-accent-dim');
    root()?.style.removeProperty('--t-accent-soft');
  }
  save(o);
}

export function applyPreset(p: Preset) {
  const o = getOverrides();
  o['--t-accent'] = p.accent;
  o['--t-accent-dim'] = p.accentDim;
  o['--t-accent-soft'] = p.accentSoft;
  o.__preset = p.id;
  save(o);
  const r = root();
  r?.style.setProperty('--t-accent', p.accent);
  r?.style.setProperty('--t-accent-dim', p.accentDim);
  r?.style.setProperty('--t-accent-soft', p.accentSoft);
}

export function activePresetId(): string | null {
  return (getOverrides().__preset as string) ?? null;
}

export function resetAll() {
  const o = getOverrides();
  const r = root();
  for (const k of Object.keys(o)) if (k.startsWith('--')) r?.style.removeProperty(k);
  save({});
}

export function hasOverrides(): boolean {
  return Object.keys(getOverrides()).some((k) => k.startsWith('--'));
}

/** Re-apply all saved overrides (call on dashboard mount). */
export function applySaved() {
  const o = getOverrides();
  const r = root();
  if (r) for (const [k, v] of Object.entries(o)) if (k.startsWith('--')) r.style.setProperty(k, v);
  applyBgSaved();
}

/* ─── background image ───────────────────────────────────────────────── */

export function getBg(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(BG_KEY); } catch { return null; }
}
export function setBg(dataUrl: string) {
  try { localStorage.setItem(BG_KEY, dataUrl); } catch { /* quota */ }
  applyBg(dataUrl);
}
export function removeBg() {
  try { localStorage.removeItem(BG_KEY); } catch { /* ignore */ }
  const m = main();
  if (m) { m.style.backgroundImage = ''; m.style.backgroundSize = ''; m.style.backgroundPosition = ''; }
}
function applyBg(dataUrl: string) {
  const m = main();
  if (m) { m.style.backgroundImage = `url(${dataUrl})`; m.style.backgroundSize = 'cover'; m.style.backgroundPosition = 'center'; }
}
export function applyBgSaved() { const b = getBg(); if (b) applyBg(b); }

/* ─── default model ──────────────────────────────────────────────────── */

export function getDefaultModel(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(DEFAULT_MODEL_KEY); } catch { return null; }
}
export function setDefaultModel(id: string) {
  try { localStorage.setItem(DEFAULT_MODEL_KEY, id); } catch { /* ignore */ }
}
