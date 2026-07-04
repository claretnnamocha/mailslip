"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
  density: "comfortable" | "compact";
  setDensity: (density: "comfortable" | "compact") => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [density, setDensityState] = useState<"comfortable" | "compact">("comfortable");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const storedTheme = localStorage.getItem("mailslip-theme") as Theme | null;
    const storedDensity = localStorage.getItem("mailslip-density") as
      | "comfortable"
      | "compact"
      | null;
    if (storedTheme) setThemeState(storedTheme);
    if (storedDensity) setDensityState(storedDensity);
  }, []);

  useEffect(() => {
    const next = resolveTheme(theme);
    setResolved(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.dataset.density = density;
  }, [theme, density]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(mq.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (value: Theme) => {
    setThemeState(value);
    localStorage.setItem("mailslip-theme", value);
  };

  const setDensity = (value: "comfortable" | "compact") => {
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
