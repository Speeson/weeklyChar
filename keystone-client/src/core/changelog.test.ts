import { describe, expect, it } from "vitest";
import { findPostUpdateChangelog, markChangelogSeen, type VersionStorage } from "./changelog";

function memoryStorage(initial: string | null = null): VersionStorage {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
  };
}

describe("post-update changelog", () => {
  it("does not show on a first install and records the version", () => {
    const storage = memoryStorage();
    expect(findPostUpdateChangelog(storage, "0.3.0", "Notas")).toBeNull();
    expect(storage.getItem("keystoneclient.changelog.seenVersion")).toBe("0.3.0");
  });

  it("shows bundled notes once after the version changes", () => {
    const storage = memoryStorage("0.3.0");
    expect(findPostUpdateChangelog(storage, "0.4.0", "Novedades")).toEqual({
      version: "0.4.0",
      notes: "Novedades",
    });
    markChangelogSeen(storage, "0.4.0");
    expect(findPostUpdateChangelog(storage, "0.4.0", "Novedades")).toBeNull();
  });
});
