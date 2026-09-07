import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { WowheadTooltipProvider } from "./components/WowheadTooltip";
import { ThemeProvider } from "./theme/ThemeProvider";
import { applyThemeToDocument } from "./theme/theme.dom";
import { readStoredTheme } from "./theme/theme.storage";

applyThemeToDocument(readStoredTheme());
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <WowheadTooltipProvider>
        <App />
      </WowheadTooltipProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
