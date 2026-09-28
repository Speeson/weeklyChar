import { describe, expect, it } from "vitest";
import type { TalentTreeSnapshot } from "./types";
import { heroTalentIcon } from "./heroTalentIcons";

describe("heroTalentIcon", () => {
  it("resolves the official atlas captured by the addon", () => {
    const icon = heroTalentIcon({ iconAtlas: "talents-heroclass-druid-eluneschosen" } as TalentTreeSnapshot);
    expect(icon?.atlas).toBe("talents-heroclass-druid-eluneschosen");
    expect(icon?.backgroundImage).toContain("hero-talent-icons.webp");
  });

  it("supports old snapshots that only captured the Hero subtree ID", () => {
    expect(heroTalentIcon({ subTreeId: 24 } as TalentTreeSnapshot)?.atlas)
      .toBe("talents-heroclass-druid-eluneschosen");
  });

  it("leaves unknown future Hero trees to the existing talent-entry fallback", () => {
    expect(heroTalentIcon({ iconAtlas: "talents-heroclass-future" } as TalentTreeSnapshot)).toBeNull();
  });
});
