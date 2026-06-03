"use client";

import { createContext, useContext, useEffect, ReactNode } from "react";

// Dark-only. Light mode was removed - the API (theme/toggle) is kept so existing
// callers keep working, but theme is always "dark" and toggle is a no-op.
type Theme = "dark";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
    localStorage.setItem("aero-theme", "dark");
    // Notify the WebGL terrain to recolor.
    window.dispatchEvent(new CustomEvent("aero-theme"));
  }, []);

  const toggle = () => {};

  return <ThemeContext.Provider value={{ theme: "dark", toggle }}>{children}</ThemeContext.Provider>;
}

/** Pre-paint script - always dark. */
export const themeScript = `(function(){try{document.documentElement.dataset.theme='dark';localStorage.setItem('aero-theme','dark');}catch(e){document.documentElement.dataset.theme='dark';}})();`;
