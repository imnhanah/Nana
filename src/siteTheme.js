import { useCallback, useEffect, useState } from 'react';

const key = 'tj:site-theme';
const eventName = 'tj:theme-change';
const accentKey = 'tj:profile-accent';
export const ACCENT_OPTIONS = [
  { id: 'mint', label: 'Mint', dark: '#6EE7B7', light: '#059669' }, { id: 'blue', label: 'Blue', dark: '#60A5FA', light: '#2563EB' },
  { id: 'violet', label: 'Violet', dark: '#A78BFA', light: '#7C3AED' }, { id: 'teal', label: 'Teal', dark: '#2DD4BF', light: '#0F766E' },
  { id: 'amber', label: 'Amber', dark: '#FBBF24', light: '#D97706' }, { id: 'rose', label: 'Rose', dark: '#FB7185', light: '#E11D48' },
];
export const normaliseThemePreference = (value) => ['dark', 'light', 'system'].includes(value) ? value : 'dark';
export const normaliseAccent = (value) => value === 'default' || ACCENT_OPTIONS.some((accent) => accent.id === value) ? value : 'mint';
function readTheme(fallback) { try { const value = localStorage.getItem(key); if (['light', 'dark', 'system'].includes(value)) return value; } catch {} return normaliseThemePreference(fallback); }
const systemTheme = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
export function applyAccent(accentId, theme) {
  const selected = normaliseAccent(accentId);
  const accent = ACCENT_OPTIONS.find((item) => item.id === selected) || null;
  if (selected === 'default') {
    const target = document.querySelector('.tj-root') || document.documentElement;
    const names = ['--tj-accent', '--tj-green', '--tj-primary-hover', '--tj-primary-muted', '--tj-accent-muted', '--tj-accent-border', '--tj-scroll-thumb', '--tj-scroll-thumb-hover'];
    names.forEach((name) => { document.documentElement.style.removeProperty(name); target.style.removeProperty(name); });
    target.dataset.profileAccent = 'default';
    return theme === 'light' ? '#44A188' : '#50C6A0';
  }
  const color = theme === 'light' ? accent.light : accent.dark;
  const target = document.querySelector('.tj-root') || document.documentElement;
  // Set values on the app root as well as :root. The light-theme class owns
  // its own CSS variables, so this makes an accent selected in light mode win
  // over those defaults too.
  const set = (name, value) => { document.documentElement.style.setProperty(name, value); target.style.setProperty(name, value); };
  target.dataset.profileAccent = selected;
  set('--tj-accent', color);
  // --tj-green is the journal's established highlight token. Keeping it in
  // sync makes selected cards, hover light, focus rings, progress and sidebar
  // actions all use the profile accent in both themes.
  set('--tj-green', color);
  set('--tj-primary-hover', `color-mix(in srgb, ${color} 82%, #000)`);
  set('--tj-primary-muted', `color-mix(in srgb, ${color} 16%, transparent)`);
  set('--tj-accent-muted', `color-mix(in srgb, ${color} 16%, transparent)`);
  set('--tj-accent-border', `color-mix(in srgb, ${color} 48%, var(--tj-border))`);
  set('--tj-scroll-thumb', `color-mix(in srgb, ${color} 56%, var(--tj-scroll-track))`);
  set('--tj-scroll-thumb-hover', color);
  return color;
}
export function useSiteTheme(fallback = 'dark') {
  const [preference, setPreference] = useState(() => readTheme(fallback));
  const [system, setSystem] = useState(() => systemTheme());
  const theme = preference === 'system' ? system : preference;
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const syncSystem = () => setSystem(media?.matches ? 'dark' : 'light');
    media?.addEventListener?.('change', syncSystem);
    const sync = event => setPreference(normaliseThemePreference(event.detail || readTheme(fallback)));
    const storage = event => { if (event.key === key) sync(event); };
    window.addEventListener(eventName, sync);
    window.addEventListener('storage', storage);
    return () => { media?.removeEventListener?.('change', syncSystem); window.removeEventListener(eventName, sync); window.removeEventListener('storage', storage); };
  }, [fallback]);
  useEffect(() => {
    // Do not force a resolved color scheme while using System. Leaving both
    // schemes available lets Chromium/Safari continue to follow macOS changes.
    document.documentElement.style.colorScheme = preference === 'system' ? 'light dark' : theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === 'light' ? '#f3f8f7' : '#0b1016';
    try { localStorage.setItem(key, preference); } catch {}
  }, [theme, preference]);
  const changeTheme = useCallback(value => {
    const next = normaliseThemePreference(value);
    try { localStorage.setItem(key, next); } catch {}
    setPreference(next);
    window.dispatchEvent(new CustomEvent(eventName, { detail: next }));
  }, []);
  return [theme, changeTheme, preference];
}

export function useProfileAccent(fallback = 'mint', theme = 'dark') {
  const [accent, setAccent] = useState(() => { try { return normaliseAccent(localStorage.getItem(accentKey) || fallback); } catch { return normaliseAccent(fallback); } });
  useEffect(() => { applyAccent(accent, theme); try { localStorage.setItem(accentKey, accent); } catch {} }, [accent, theme]);
  return [accent, useCallback((value) => setAccent(normaliseAccent(value)), [])];
}
