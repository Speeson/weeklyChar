import { render, screen } from "@testing-library/react";
import { Circle, Save, X } from "lucide-react";
import { describe, expect, expectTypeOf, it } from "vitest";
import { ThemeProvider } from "../theme/ThemeProvider";
import {
  resolveThemeIcon,
  type ThemeIconOverrides,
  type ThemeIconRole,
} from "../theme/icon.registry";
import { ThemedIcon } from "./ThemedIcon";

describe("theme icon resolution", () => {
  it("maps semantic roles to the current Keystone Lucide icons", () => {
    expect(resolveThemeIcon("keystone", "close")).toBe(X);
    expect(resolveThemeIcon("keystone", "save")).toBe(Save);
  });

  it("uses an optional theme override when one is registered", () => {
    const overrides: ThemeIconOverrides = {
      poison: { close: Circle },
    };

    expect(resolveThemeIcon("poison", "close", overrides)).toBe(Circle);
  });

  it("falls back deterministically to the base icon when an override is missing", () => {
    expect(resolveThemeIcon("poison", "close")).toBe(X);
    expect(resolveThemeIcon("poison", "save")).toBe(Save);
  });

  it("restricts callers to the declared semantic role contract", () => {
    expectTypeOf<Parameters<typeof resolveThemeIcon>[1]>().toEqualTypeOf<ThemeIconRole>();
    // @ts-expect-error Unknown roles must remain a compile-time error.
    resolveThemeIcon("keystone", "unknown-role");
  });
});

describe("ThemedIcon", () => {
  it("fails clearly when rendered outside ThemeProvider", () => {
    expect(() => render(<ThemedIcon name="save" />)).toThrowError(
      "useTheme must be used within a ThemeProvider.",
    );
  });

  it("preserves requested dimensions, classes, and decorative accessibility", () => {
    const { container } = render(
      <ThemeProvider>
        <ThemedIcon className="test-icon" name="save" size={18} />
      </ThemeProvider>,
    );

    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("width", "18");
    expect(icon).toHaveAttribute("height", "18");
    expect(icon).toHaveClass("test-icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes an accessible image when a label is provided", () => {
    render(
      <ThemeProvider>
        <ThemedIcon label="Save changes" name="save" />
      </ThemeProvider>,
    );

    const icon = screen.getByRole("img", { name: "Save changes" });
    expect(icon).not.toHaveAttribute("aria-hidden");
  });
});
