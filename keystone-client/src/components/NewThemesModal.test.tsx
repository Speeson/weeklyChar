import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../core/i18n";
import { ThemeProvider } from "../theme/ThemeProvider";
import { THEME_STORAGE_KEY } from "../theme/theme.types";
import { NewThemesModal } from "./NewThemesModal";

describe("NewThemesModal", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("lets users try Frost and Heaven without closing the announcement", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <ThemeProvider>
        <I18nProvider language="es">
          <NewThemesModal onClose={onClose} />
        </I18nProvider>
      </ThemeProvider>,
    );

    expect(screen.getByRole("dialog", { name: "Dos nuevos temas visuales" })).toBeInTheDocument();
    expect(container.querySelectorAll(".new-themes-modal__grid .settings-theme-card__preview")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Frost" }));
    expect(screen.getByRole("button", { name: "Frost" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.theme).toBe("frost");
    await user.click(screen.getByRole("button", { name: "Heaven" }));
    expect(screen.getByRole("button", { name: "Heaven" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("heaven");
    expect(onClose).not.toHaveBeenCalled();
  });
});
