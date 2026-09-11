import { beforeEach, describe, expect, it } from "vitest";
import {
  INACTIVE_CHARACTER_IDS_STORAGE_KEY, loadInactiveCharacterIds, saveInactiveCharacterIds,
} from "./characterTracking";

describe("characterTracking", () => {
  beforeEach(() => localStorage.clear());

  it("persists a stable de-duplicated set of inactive character ids", () => {
    saveInactiveCharacterIds(["char-b", "char-a", "char-b"]);
    expect(localStorage.getItem(INACTIVE_CHARACTER_IDS_STORAGE_KEY)).toBe('["char-a","char-b"]');
    expect([...loadInactiveCharacterIds()]).toEqual(["char-a", "char-b"]);
  });

  it("falls back to all characters active when storage is invalid", () => {
    localStorage.setItem(INACTIVE_CHARACTER_IDS_STORAGE_KEY, "not-json");
    expect(loadInactiveCharacterIds()).toEqual(new Set());
    localStorage.setItem(INACTIVE_CHARACTER_IDS_STORAGE_KEY, '{"id":"char-a"}');
    expect(loadInactiveCharacterIds()).toEqual(new Set());
  });
});
