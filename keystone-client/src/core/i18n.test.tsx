import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
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

  it("keeps singular and plural Team member copy explicit in both languages", () => {
    expect(translate("es", "teams.characterCountOne", { count: 1 })).toBe("1 personaje");
    expect(translate("es", "teams.characterCount", { count: 2 })).toBe("2 personajes");
    expect(translate("en", "teams.characterCountOne", { count: 1 })).toBe("1 character");
    expect(translate("en", "teams.characterCount", { count: 2 })).toBe("2 characters");
  });

  it("updates consumers when language changes", () => {
    const view = render(<I18nProvider language="es"><Probe /></I18nProvider>);
    expect(screen.getByText("Sincronizacion")).toBeInTheDocument();
    view.rerender(<I18nProvider language="en"><Probe /></I18nProvider>);
    expect(screen.getByText("Sync")).toBeInTheDocument();
  });

  it("keeps the translator identity stable across unrelated provider rerenders", () => {
    const observed = vi.fn();
    function IdentityProbe() {
      const { t } = useI18n();
      useEffect(() => observed(t), [t]);
      return null;
    }
    const view = render(<I18nProvider language="es"><IdentityProbe /><span>one</span></I18nProvider>);
    view.rerender(<I18nProvider language="es"><IdentityProbe /><span>two</span></I18nProvider>);
    expect(observed).toHaveBeenCalledOnce();
    view.rerender(<I18nProvider language="en"><IdentityProbe /></I18nProvider>);
    expect(observed).toHaveBeenCalledTimes(2);
  });
});
