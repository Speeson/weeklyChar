import { describe, expect, it } from "vitest";
import { localizedReleaseNotes } from "./releaseNotes";

describe("localized release notes", () => {
  const bilingual = "<!-- lang:es -->\n# Versión\n\n## Cambios\n\n- Español\n\n<!-- lang:en -->\n# Release\n\n## Changes\n\n- English";

  it("selects the requested marked language", () => {
    expect(localizedReleaseNotes(bilingual, "es")).toContain("Español");
    expect(localizedReleaseNotes(bilingual, "es")).not.toContain("English");
    expect(localizedReleaseNotes(bilingual, "en")).toContain("English");
    expect(localizedReleaseNotes(bilingual, "en")).not.toContain("Español");
  });

  it("keeps legacy Spanish notes in Spanish and avoids leaking them into English", () => {
    expect(localizedReleaseNotes("## Cambios\n\n- Corrección", "es")).toContain("Corrección");
    expect(localizedReleaseNotes("## Cambios\n\n- Corrección", "en")).toBe("No English release notes are available for this version.");
  });
});
