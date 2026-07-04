"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [density, setDensityState] = useState<Density>("comfortable");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Sync from storage + DOM before paint so React never reverts the inline script.
  useLayoutEffect(() => {
    const nextTheme = readStoredTheme();
    const nextDensity = readStoredDensity();
    setThemeState(nextTheme);
    setDensityState(nextDensity);
    applyThemeClass(nextTheme);
    setResolved(resolveTheme(nextTheme));
    document.documentElement.dataset.density = nextDensity;
  }, []);

  useLayoutEffect(() => {
    applyThemeClass(theme);
    setResolved(resolveTheme(theme));
    document.documentElement.dataset.density = density;
  }, [theme, density]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const next = mq.matches ? "dark" : "light";
      setResolved(next);
      document.documentElement.style.colorScheme = next;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (value: Theme) => {
    setThemeState(value);
    localStorage.setItem("mailslip-theme", value);
  };

  const setDensity = (value: Density) => {
    setDensityState(value);
    localStorage.setItem("mailslip-density", value);
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
