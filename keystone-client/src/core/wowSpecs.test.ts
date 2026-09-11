import { describe, expect, it } from "vitest";
import { specializationsForClass, WOW_SPECIALIZATIONS, wowClassIconUrl, wowSpecializationIconUrl } from "./wowSpecs";

describe("WoW Planner icon catalog", () => {
  it("has an official class and specialization icon for every supported specialization", () => {
    for (const specialization of WOW_SPECIALIZATIONS) {
      expect(wowClassIconUrl(specialization.wowClass), specialization.wowClass).toMatch(/^https:\/\/render\.worldofwarcraft\.com\/eu\/icons\/56\/classicon_/u);
      expect(wowSpecializationIconUrl(specialization.id), `${specialization.wowClass} ${specialization.name}`).toMatch(/^https:\/\/render\.worldofwarcraft\.com\/eu\/icons\/56\/\d+\.jpg$/u);
    }
  });

  it("rejects unknown class and specialization identities", () => {
    expect(wowClassIconUrl("Unknown")).toBeNull();
    expect(wowSpecializationIconUrl(999_999)).toBeNull();
  });

  it("orders tank specializations before healers and damage dealers", () => {
    expect(specializationsForClass("Druid").map(specialization => `${specialization.role}:${specialization.name}`)).toEqual([
      "tank:Guardian", "healer:Restoration", "dps:Balance", "dps:Feral",
    ]);
  });
});
