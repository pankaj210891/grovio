/**
 * useDarkMode — vendor portal dark mode hook.
 * Reads/writes localStorage 'grovio_theme' key.
 * Applies .dark class on document.documentElement.
 */

import { useEffect, useState, useCallback } from 'react';

type ThemePreference = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'grovio_theme';

function getSystemPreference(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveIsDark(preference: ThemePreference): boolean {
  if (preference === 'dark') return true;
  if (preference === 'light') return false;
  return getSystemPreference();
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch { /* ignore */ }
  return 'system';
}

export function useDarkMode() {
  const [preference, setPreference] = useState<ThemePreference>(() => readStoredPreference());
  const [isDark, setIsDark] = useState<boolean>(() => resolveIsDark(readStoredPreference()));

  useEffect(() => {
    const dark = resolveIsDark(preference);
    document.documentElement.classList.toggle('dark', dark);
    setIsDark(dark);
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
      setIsDark(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  const setTheme = useCallback((t: ThemePreference) => {
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
    setPreference(t);
  }, []);

  const toggle = useCallback(() => setTheme(isDark ? 'light' : 'dark'), [isDark, setTheme]);

  return { isDark, preference, toggle, setTheme };
}
