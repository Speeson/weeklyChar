import { useContext } from "react";
import { ThemeContext, type ThemeContextValue } from "./ThemeProvider";
import { DEFAULT_THEME, type ThemeId } from "./theme.types";

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }

  return context;
}

export function useResolvedThemeId(): ThemeId {
  return useContext(ThemeContext)?.theme ?? DEFAULT_THEME;
}
