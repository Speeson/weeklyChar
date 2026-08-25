import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./theme/ThemeProvider";
import { applyThemeToDocument } from "./theme/theme.dom";
import { readStoredTheme } from "./theme/theme.storage";

applyThemeToDocument(readStoredTheme());
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
