import { describe, expect, it } from "vitest";
import type { Character } from "./types";
import {
  MISSING_CHARACTER_VALUE,
  classColor,
  displayNumber,
  itemLevelColor,
  raiderIoColor,
  sortCharacters,
} from "./characterDisplay";

function character(overrides: Partial<Character>): Character {
  return {
    id: overrides.id ?? String(overrides.name),
    name: overrides.name ?? "Character",
    realm: overrides.realm ?? "Realm",
    region: overrides.region ?? "eu",
    wowAccount: null,
    wowClass: null,
    avatarUrl: null,
    ilvl: null,
    rioScore: null,
    currentKeystone: null,
    keystoneDisplay: MISSING_CHARACTER_VALUE,
    ...overrides,
  };
}

describe("character display", () => {
  it("maps WoW classes and falls back to a neutral color", () => {
    expect(classColor("Death Knight")).toBe("#C41E3A");
    expect(classColor("MAGE")).toBe("#3FC7EB");
    expect(classColor(null)).toBe("#DDE2F0");
  });

  it("interpolates item level continuously and clamps the approved range", () => {
    expect(itemLevelColor(200)).toBe("#00C800");
    expect(itemLevelColor(250)).toBe("#00C800");
    expect(itemLevelColor(262)).toBe("#009673");
    expect(itemLevelColor(344)).toBe("#FF9100");
    expect(itemLevelColor(400)).toBe("#FF9100");
    expect(itemLevelColor(Number.NaN)).toBeNull();
  });

  it("renders Raider.IO zero as a real green score", () => {
    expect(displayNumber(0)).toBe("0");
    expect(raiderIoColor(0)).toBe("#00C800");
    expect(raiderIoColor(4500)).toBe("#FF9100");
    expect(displayNumber(null)).toBe(MISSING_CHARACTER_VALUE);
  });

  it("sorts all table keys and keeps missing numeric values last", () => {
    const rows = [
      character({ id: "a", name: "Zulu", realm: "A", ilvl: null, rioScore: null }),
      character({ id: "b", name: "Alpha", realm: "Z", ilvl: 290, rioScore: 0, currentKeystone: { level: 2, dungeon: null, challengeMapId: null, mapId: null } }),
      character({ id: "c", name: "Bravo", realm: "M", ilvl: 300, rioScore: 2000, currentKeystone: { level: 10, dungeon: null, challengeMapId: null, mapId: null } }),
    ];

    expect(sortCharacters(rows, "name", "asc").map((row) => row.id)).toEqual(["b", "c", "a"]);
    expect(sortCharacters(rows, "realm", "desc").map((row) => row.id)).toEqual(["b", "c", "a"]);
    expect(sortCharacters(rows, "ilvl", "desc").map((row) => row.id)).toEqual(["c", "b", "a"]);
    expect(sortCharacters(rows, "keystone", "asc").map((row) => row.id)).toEqual(["b", "c", "a"]);
    expect(sortCharacters(rows, "rioScore", "desc").map((row) => row.id)).toEqual(["c", "b", "a"]);
  });
});
