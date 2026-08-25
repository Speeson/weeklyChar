import { createContext, useCallback, useState, type ReactNode } from "react";
import { applyThemeToDocument } from "./theme.dom";
import { THEMES, resolveThemeId } from "./theme.registry";
import { readStoredTheme, writeStoredTheme } from "./theme.storage";
import type { ThemeDefinition, ThemeId } from "./theme.types";

export type ThemeContextValue = {
  theme: ThemeId;
  themes: readonly ThemeDefinition[];
  setTheme: (theme: ThemeId) => void;
};

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setCurrentTheme] = useState<ThemeId>(readStoredTheme);
  const setTheme = useCallback((candidate: ThemeId) => {
    const nextTheme = resolveThemeId(candidate);
    applyThemeToDocument(nextTheme);
    writeStoredTheme(nextTheme);
    setCurrentTheme(nextTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, themes: THEMES, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
