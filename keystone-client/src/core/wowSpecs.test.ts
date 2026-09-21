import { describe, expect, it } from "vitest";
import { specName, specializationsForClass, WOW_SPECIALIZATIONS, wowClassIconUrl, wowClassName, wowSpecializationIconUrl } from "./wowSpecs";

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

  it("maps the two Monk damage and healing specialization artworks correctly", () => {
    expect(wowSpecializationIconUrl(269)).toBe("https://render.worldofwarcraft.com/eu/icons/56/608953.jpg");
    expect(wowSpecializationIconUrl(270)).toBe("https://render.worldofwarcraft.com/eu/icons/56/608952.jpg");
  });

  it("orders tank specializations before healers and damage dealers", () => {
    expect(specializationsForClass("Druid").map(specialization => `${specialization.role}:${specialization.name}`)).toEqual([
      "tank:Guardian", "healer:Restoration", "dps:Balance", "dps:Feral",
    ]);
  });

  it("has canonical English and European Spanish names for every supported specialization", () => {
    expect(WOW_SPECIALIZATIONS).toHaveLength(40);
    for (const specialization of WOW_SPECIALIZATIONS) {
      expect(specName(specialization.id, "en")).toBe(specialization.name);
      expect(specName(specialization.id, "es")).toBe(specialization.nameEs);
    }
  });

  it("preserves a snapshot fallback for a future unknown specialization", () => {
    expect(specName(999_999, "es", "Especialización futura")).toBe("Especialización futura");
  });

  it("localizes all supported classes in both directions", () => {
    const classes = new Map(WOW_SPECIALIZATIONS.map(spec => [spec.wowClass, wowClassName(spec.wowClass, "es")]));
    expect(classes.size).toBe(13);
    for (const [english, spanish] of classes) {
      expect(spanish).not.toBe(english);
      expect(wowClassName(spanish, "en")).toBe(english);
    }
  });
});
