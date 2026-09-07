import { describe, expect, it } from "vitest";
import { blizzardIconUrl, buildWowheadTooltip, talentTooltipSpellId, wowheadDomainForLanguage } from "./wowhead";

describe("Wowhead tooltip serialization", () => {
  it("serializes the exact equipped item variant deterministically", () => {
    expect(buildWowheadTooltip({
      type: "item", id: 123, language: "es",
      options: { ench: 456, gems: [1001, 1002], bonus: [2001, 2002], ilvl: 331, lvl: 90 },
    })).toEqual({
      href: "https://www.wowhead.com/item=123",
      dataWowhead: "domain=es&ench=456&gems=1001:1002&bonus=2001:2002&ilvl=331&lvl=90",
    });
  });

  it("omits absent, empty, and invalid identifiers", () => {
    expect(buildWowheadTooltip({
      type: "item", id: 12, language: "en", options: { ench: null, gems: [], bonus: [-1, 0, 2.2], ilvl: NaN },
    })?.dataWowhead).toBe("domain=www");
    expect(buildWowheadTooltip({ type: "item", id: -1, language: "es" })).toBeNull();
  });

  it("uses spell ids for talents and never derives them from enchant ids", () => {
    expect(talentTooltipSpellId(1254400, 998877)).toBe(1254400);
    expect(talentTooltipSpellId(null, 998877)).toBe(998877);
    expect(buildWowheadTooltip({ type: "spell", id: 1254400, language: "es", options: { lvl: 90 } })).toEqual({
      href: "https://www.wowhead.com/spell=1254400",
      dataWowhead: "domain=es&lvl=90",
    });
    expect(buildWowheadTooltip({ type: "item", id: 123, language: "es", options: { ench: 456 } })?.href)
      .toBe("https://www.wowhead.com/item=123");
  });

  it("maps tooltip localization centrally", () => {
    expect(wowheadDomainForLanguage("es")).toBe("es");
    expect(wowheadDomainForLanguage("en")).toBe("www");
  });

  it("builds Blizzard-owned icon URLs from captured FileData IDs and legacy paths", () => {
    expect(blizzardIconUrl("FileData ID 7734058", "eu", 7734058))
      .toBe("https://render.worldofwarcraft.com/eu/icons/56/7734058.jpg");
    expect(blizzardIconUrl(null, "us", 133785))
      .toBe("https://render.worldofwarcraft.com/us/icons/56/133785.jpg");
    expect(blizzardIconUrl("Interface\\Icons\\INV_Misc_Key_15", "eu"))
      .toBe("https://render.worldofwarcraft.com/eu/icons/56/inv_misc_key_15.jpg");
    expect(blizzardIconUrl("javascript:alert(1)", "eu")).toBeNull();
  });
});
