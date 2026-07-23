"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const themeEvent = "vocab-theme-change";

const subscribe = (callback: () => void) => {
  window.addEventListener(themeEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(themeEvent, callback);
    window.removeEventListener("storage", callback);
  };
};

const getSnapshot = () => document.documentElement.dataset.theme === "light";
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const isLight = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = () => {
    const nextTheme = isLight ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("vocab-theme", nextTheme);
    window.dispatchEvent(new Event(themeEvent));
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle grid size-11 shrink-0 place-items-center text-muted"
      aria-label={isLight ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng"}
      title={isLight ? "Giao diện tối" : "Giao diện sáng"}
    >
      {isLight ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
    </button>
  );
}
