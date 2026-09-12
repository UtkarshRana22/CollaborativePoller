'use client';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      // localStorage can throw in some contexts (private browsing, etc.) —
      // theme just won't persist across reloads, harmless otherwise.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="fixed top-4 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-base text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
