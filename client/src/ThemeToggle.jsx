import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

function initialTheme() {
  try {
    const saved = localStorage.getItem('sweety.theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* A theme still works when browser storage is unavailable. */ }
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(initialTheme);
  const dark = theme === 'dark';
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme';

  function toggle() {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('sweety.theme', next); } catch { /* Keep the selected theme for this page. */ }
    setTheme(next);
  }

  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label} aria-pressed={dark}>{dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}<span>{dark ? 'Light' : 'Dark'}</span></button>;
}
