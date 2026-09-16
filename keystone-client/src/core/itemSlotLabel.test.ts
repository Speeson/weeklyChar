import { describe, expect, it } from "vitest";
import type { KeystoneSelectorObjective } from "./types";
import { compactItemSlotLabel } from "./itemSlotLabel";

const metadata = (overrides: Partial<KeystoneSelectorObjective>): Pick<KeystoneSelectorObjective, "slotId" | "slotName" | "itemClassName" | "itemSubClassName"> => ({
  slotId: null, slotName: null, itemClassName: null, itemSubClassName: null, ...overrides,
});

describe("compactItemSlotLabel", () => {
  it.each([
    ["Espadas de una mano", "1M Esp."], ["Mazas de dos manos", "2M Maza"],
    ["Hachas de una mano", "1M Hacha"], ["Armas de asta", "Arm. Asta"],
    ["Báculo", "Bastón"], ["Dagas", "Daga"],
  ])("abbreviates Spanish weapon subtype %s", (itemSubClassName, expected) => {
    expect(compactItemSlotLabel(metadata({ slotId: 16, slotName: "Mano principal", itemClassName: "Arma", itemSubClassName }), "es")).toBe(expected);
  });

  it("uses localized armor and accessory slots", () => {
    expect(compactItemSlotLabel(metadata({ slotId: 5, slotName: "Pecho", itemClassName: "Armadura", itemSubClassName: "Tela" }), "es")).toBe("Pecho");
    expect(compactItemSlotLabel(metadata({ slotId: 13, slotName: "Abalorio" }), "es")).toBe("Abal.");
    expect(compactItemSlotLabel(metadata({ slotId: 11, slotName: "Finger" }), "en")).toBe("Ring");
  });

  it("falls back to the equipment slot id and omits unknown metadata", () => {
    expect(compactItemSlotLabel(metadata({ slotId: 8 }), "es")).toBe("Pies");
    expect(compactItemSlotLabel(metadata({}), "es")).toBeNull();
  });
});
