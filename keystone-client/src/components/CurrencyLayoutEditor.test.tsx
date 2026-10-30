import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { defaultCurrencyLayout, type CurrencyLayout } from "../core/currencyLayout";
import { CurrencyLayoutEditor } from "./CurrencyLayoutEditor";

function EditorHarness() {
  const [layout, setLayout] = useState<CurrencyLayout>(defaultCurrencyLayout);
  return <CurrencyLayoutEditor characterCount={2} characterName="Bakuhatsu" currencies={{}} language="es" layout={layout} onApplyToAll={() => undefined} onChange={setLayout} onClose={() => undefined} region="eu"/>;
}

function slot(index: number) {
  return document.querySelector(`[data-currency-slot="${index}"]`)!;
}

function transfer() {
  const values = new Map<string, string>();
  return {
    setData: (type: string, value: string) => { values.set(type, value); },
    getData: (type: string) => values.get(type) ?? "",
    effectAllowed: "move",
  };
}

describe("CurrencyLayoutEditor", () => {
  it("shows sixteen icon slots and the unplaced choices", () => {
    render(<EditorHarness/>);
    expect(screen.getByRole("dialog", { name: "Organizar monedas" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-currency-slot]")).toHaveLength(16);
    expect(screen.getByRole("button", { name: /Añadir Inframoneda/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Añadir Blasón de bruma de héroe/i })).not.toBeInTheDocument();
  });

  it("clicks an unplaced item into the first free slot", async () => {
    render(<EditorHarness/>);
    await userEvent.click(screen.getByRole("button", { name: /Añadir Inframoneda/i }));
    expect(slot(5)).toHaveAttribute("data-currency", "undercoin");
  });

  it("highlights the list choice and its first free slot on hover", () => {
    render(<EditorHarness/>);
    const choice = screen.getByRole("button", { name: /Añadir Inframoneda/i });
    fireEvent.mouseEnter(choice);
    expect(choice).toHaveClass("is-hovered");
    expect(slot(5)).toHaveClass("is-click-target");
    fireEvent.mouseLeave(choice);
    expect(slot(5)).not.toHaveClass("is-click-target");
  });

  it("highlights the slot under a dragged currency and clears it on drop", () => {
    render(<EditorHarness/>);
    const dataTransfer = transfer();
    fireEvent.dragStart(screen.getByRole("button", { name: /Añadir Inframoneda/i }), { dataTransfer });
    fireEvent.dragOver(slot(0), { dataTransfer });
    expect(slot(0)).toHaveClass("is-drop-target");
    fireEvent.drop(slot(0), { dataTransfer });
    expect(slot(0)).not.toHaveClass("is-drop-target");
  });

  it("replaces a targeted slot from the list and returns the displaced card", () => {
    render(<EditorHarness/>);
    const dataTransfer = transfer();
    fireEvent.dragStart(screen.getByRole("button", { name: /Añadir Inframoneda/i }), { dataTransfer });
    fireEvent.drop(slot(0), { dataTransfer });
    expect(slot(0)).toHaveAttribute("data-currency", "undercoin");
    expect(screen.getByRole("button", { name: /Añadir Blasón de bruma de héroe/i })).toBeInTheDocument();
  });

  it("swaps two occupied slots and can move one into an empty slot", () => {
    render(<EditorHarness/>);
    const first = transfer();
    fireEvent.dragStart(slot(0), { dataTransfer: first });
    fireEvent.drop(slot(8), { dataTransfer: first });
    expect(slot(0)).toHaveAttribute("data-currency", "mythMistcrest");
    expect(slot(8)).toHaveAttribute("data-currency", "heroMistcrest");
    const second = transfer();
    fireEvent.dragStart(slot(8), { dataTransfer: second });
    fireEvent.drop(slot(15), { dataTransfer: second });
    expect(slot(8)).not.toHaveAttribute("data-currency");
    expect(slot(15)).toHaveAttribute("data-currency", "heroMistcrest");
  });

  it("removes a card and restores the default layout", async () => {
    render(<EditorHarness/>);
    await userEvent.click(screen.getByRole("button", { name: /Quitar Blasón de bruma de héroe/i }));
    expect(slot(0)).not.toHaveAttribute("data-currency");
    expect(screen.getByRole("button", { name: /Añadir Blasón de bruma de héroe/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Restaurar distribución" }));
    expect(slot(0)).toHaveAttribute("data-currency", "heroMistcrest");
  });

  it("allows selecting and placing a card with keyboard focus", () => {
    render(<EditorHarness/>);
    fireEvent.keyDown(slot(0).querySelector("button")!, { key: "Enter" });
    fireEvent.keyDown(slot(15).querySelector("button")!, { key: "Enter" });
    expect(slot(0)).not.toHaveAttribute("data-currency");
    expect(slot(15)).toHaveAttribute("data-currency", "heroMistcrest");
  });

  it("places a selected list item into an occupied slot with the keyboard", () => {
    render(<EditorHarness/>);
    fireEvent.keyDown(screen.getByRole("button", { name: /Añadir Inframoneda/i }), { key: " " });
    fireEvent.keyDown(slot(0).querySelector("button")!, { key: "Enter" });
    expect(slot(0)).toHaveAttribute("data-currency", "undercoin");
    expect(slot(5)).not.toHaveAttribute("data-currency");
    expect(screen.getByRole("button", { name: /Añadir Blasón de bruma de héroe/i })).toBeInTheDocument();
  });
});
