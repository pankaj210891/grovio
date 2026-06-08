/**
 * useDarkMode — manages dark mode preference across the application.
 *
 * Reads/writes localStorage 'theme' key ('light' | 'dark' | 'system').
 * Applies the `.dark` class on `document.documentElement` (CLAUDE.md convention).
 * On 'system': respects prefers-color-scheme media query.
 *
 * Usage:
 *   const { isDark, toggle, setTheme } = useDarkMode();
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

function applyDarkClass(isDark: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', isDark);
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'system';
}

export function useDarkMode() {
  const [preference, setPreference] = useState<ThemePreference>(() => readStoredPreference());
  const [isDark, setIsDark] = useState<boolean>(() => resolveIsDark(readStoredPreference()));

  // Apply dark class on mount + preference change
  useEffect(() => {
    const dark = resolveIsDark(preference);
    applyDarkClass(dark);
    setIsDark(dark);
  }, [preference]);

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (preference !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      applyDarkClass(e.matches);
      setIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [preference]);

  const setTheme = useCallback((newTheme: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // ignore
    }
    setPreference(newTheme);
  }, []);

  const toggle = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  return { isDark, preference, toggle, setTheme };
}
