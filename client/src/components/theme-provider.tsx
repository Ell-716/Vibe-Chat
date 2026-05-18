import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  /** The stored user preference — "light", "dark", or "system". */
  theme: Theme;
  /** The actual applied theme after resolving "system" against OS preference. */
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** Reads the OS dark-mode preference via matchMedia. Defaults to dark when unknown. */
function getOsTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  // matchMedia returns matches=false both when OS is light AND when it can't
  // determine a preference. We only switch to light when there is an explicit
  // light preference; everything else (including "no preference") stays dark.
  if (mq.matches) return "dark";
  if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark"; // OS preference unknown — fall back to dark
}

/**
 * Provides light/dark/system theme context to the component tree.
 * Persists the selected preference to localStorage and applies the resolved
 * class on <html>. Defaults to "dark" when no stored preference is found.
 * When "system" is selected, the applied class follows the OS preference and
 * updates automatically when the OS setting changes.
 * @param children - Child components that will have access to theme context.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme") as Theme;
      if (stored === "light" || stored === "dark" || stored === "system") return stored;
    }
    return "dark";
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    theme === "system" ? getOsTheme() : theme
  );

  useEffect(() => {
    const resolved = theme === "system" ? getOsTheme() : theme;
    setResolvedTheme(resolved);
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    localStorage.setItem("theme", theme);

    // When "system", keep the applied class in sync with OS preference changes
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const next = e.matches ? "dark" : "light";
      setResolvedTheme(next);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(next);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);

  /** Quick toggle between dark and light — ignores "system". */
  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = resolvedTheme === "dark" ? "light" : "dark";
      return prev === "system" ? next : prev === "dark" ? "light" : "dark";
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Returns the current theme context value (theme, resolvedTheme, setTheme, toggleTheme).
 * Must be called within a ThemeProvider — throws otherwise.
 * @returns The ThemeContextValue for the nearest ThemeProvider ancestor.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
