import { describe, expect, it } from "vitest";
import { findPostUpdateChangelog, isNewThemesAnnouncementDue, markChangelogSeen, markNewThemesSeen, type VersionStorage } from "./changelog";

function memoryStorage(initial: string | null = null): VersionStorage {
  const values = new Map<string, string>();
  if (initial !== null) values.set("keystoneclient.changelog.seenVersion", initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, next) => { values.set(key, next); },
  };
}

describe("post-update changelog", () => {
  it("does not show on a first install and records the version", () => {
    const storage = memoryStorage();
    expect(findPostUpdateChangelog(storage, "0.3.0", "Notas")).toBeNull();
    expect(storage.getItem("keystoneclient.changelog.seenVersion")).toBe("0.3.0");
    expect(storage.getItem("keystoneclient.changelog.frostHeavenSeen")).toBe("true");
    expect(findPostUpdateChangelog(storage, "0.4.0", "Novedades")).toEqual({
      version: "0.4.0",
      notes: "Novedades",
      showNewThemes: false,
    });
  });

  it("shows bundled notes once after the version changes", () => {
    const storage = memoryStorage("0.3.0");
    expect(findPostUpdateChangelog(storage, "0.4.0", "Novedades")).toEqual({
      version: "0.4.0",
      notes: "Novedades",
      showNewThemes: true,
    });
    markChangelogSeen(storage, "0.4.0");
    expect(findPostUpdateChangelog(storage, "0.4.0", "Novedades")).toBeNull();
    expect(isNewThemesAnnouncementDue(storage)).toBe(true);
    markNewThemesSeen(storage);
    expect(isNewThemesAnnouncementDue(storage)).toBe(false);
    expect(findPostUpdateChangelog(storage, "0.5.0", "Más novedades")).toEqual({
      version: "0.5.0",
      notes: "Más novedades",
      showNewThemes: false,
    });
  });
});
