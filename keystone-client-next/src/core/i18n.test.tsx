import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider, translate, translations, useI18n } from "./i18n";

function Probe() {
  const { t } = useI18n();
  return <span>{t("shell.sync")}</span>;
}

describe("i18n", () => {
  it("keeps ES and EN dictionaries in exact key parity", () => {
    expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations.es).sort());
  });

  it("interpolates values", () => {
    expect(translate("en", "shell.userMenu", { name: "player" })).toBe("User menu for player");
  });

  it("updates consumers when language changes", () => {
    const view = render(<I18nProvider language="es"><Probe /></I18nProvider>);
    expect(screen.getByText("Sincronizacion")).toBeInTheDocument();
    view.rerender(<I18nProvider language="en"><Probe /></I18nProvider>);
    expect(screen.getByText("Synchronization")).toBeInTheDocument();
  });
});
