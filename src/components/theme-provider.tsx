"use client";

import { createContext, useContext, useLayoutEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
type Density = "comfortable" | "compact";

type ThemeContextValue = {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
  density: Density;
  setDensity: (density: Density) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "light" || theme === "dark") {
    root.classList.add(theme);
  }
  root.style.colorScheme = resolveTheme(theme);
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem("mailslip-theme");
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function readStoredDensity(): Density {
  if (typeof window === "undefined") return "comfortable";
  const stored = localStorage.getItem("mailslip-density");
  if (stored === "comfortable" || stored === "compact") return stored;
  return "comfortable";
}

const THEME_CHANGE_EVENT = "mailslip-theme-change";
const DENSITY_CHANGE_EVENT = "mailslip-density-change";

function subscribeTheme(callback: () => void) {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === "mailslip-theme") callback();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

function subscribeDensity(callback: () => void) {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === "mailslip-density") callback();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(DENSITY_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(DENSITY_CHANGE_EVENT, callback);
  };
}

function subscribeSystemTheme(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

const getThemeSnapshot = () => readStoredTheme();
const getThemeServerSnapshot = () => "system";
const getDensitySnapshot = () => readStoredDensity();
const getDensityServerSnapshot = () => "comfortable";
const getSystemThemeSnapshot = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
const getSystemThemeServerSnapshot = () => "light";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const density = useSyncExternalStore(subscribeDensity, getDensitySnapshot, getDensityServerSnapshot);
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    getSystemThemeServerSnapshot
  );
  const resolved = theme === "system" ? systemTheme : theme;

  useLayoutEffect(() => {
    applyThemeClass(theme);
    document.documentElement.dataset.density = density;
  }, [theme, density]);

  const setTheme = (value: Theme) => {
    localStorage.setItem("mailslip-theme", value);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  const setDensity = (value: Density) => {
    localStorage.setItem("mailslip-density", value);
    window.dispatchEvent(new Event(DENSITY_CHANGE_EVENT));
  };

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, density, setDensity }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
