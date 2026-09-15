import { useCallback, useEffect, useState } from 'react';

const key = 'tj:site-theme';
const eventName = 'tj:theme-change';
function readTheme(fallback) {
  try { const value = localStorage.getItem(key); if (value === 'light' || value === 'dark') return value; } catch {}
  return fallback === 'light' ? 'light' : 'dark';
}
export function useSiteTheme(fallback = 'dark') {
  const [theme, setTheme] = useState(() => readTheme(fallback));
  useEffect(() => {
    const sync = event => setTheme(event.detail || readTheme(fallback));
    const storage = event => { if (event.key === key) sync(event); };
    window.addEventListener(eventName, sync);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(eventName, sync); window.removeEventListener('storage', storage); };
  }, [fallback]);
  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === 'light' ? '#f3f8f7' : '#0b1016';
    try { localStorage.setItem(key, theme); } catch {}
  }, [theme]);
  const changeTheme = useCallback(value => {
    const next = value === 'light' ? 'light' : 'dark';
    try { localStorage.setItem(key, next); } catch {}
    setTheme(next);
    window.dispatchEvent(new CustomEvent(eventName, { detail: next }));
  }, []);
  return [theme, changeTheme];
}
