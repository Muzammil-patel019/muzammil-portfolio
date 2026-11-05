"use client";
import { useEffect, useState } from "react";
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => setDark(document.documentElement.dataset.theme === "dark");
    sync(); window.addEventListener("mp-theme-change", sync);
    return () => window.removeEventListener("mp-theme-change", sync);
  }, []);
  return <button type="button" className="theme-toggle" data-theme-toggle="" aria-label="Toggle dark mode" aria-pressed={dark} onClick={() => {
    const toggle = (window as Window & {mpToggleTheme?: () => void}).mpToggleTheme;
    toggle?.();
  }}>{dark ? "☀ Light" : "☾ Dark"}</button>;
}
