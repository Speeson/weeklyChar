import { describe, expect, it } from "vitest";
import { formatVaultReward } from "./vaultRewards";

describe("formatVaultReward", () => {
  it("localizes Blizzard upgrade tracks without inferring overlapping tracks from item level", () => {
    expect(formatVaultReward(318, "Myth", "es")).toBe("ilvl 318 (Mito)");
    expect(formatVaultReward(305, "Hero", "es")).toBe("ilvl 305 (Héroe)");
    expect(formatVaultReward(292, "Champion", "en")).toBe("ilvl 292 (Champion)");
  });

  it("keeps legacy rewards useful when the additive track is missing", () => {
    expect(formatVaultReward(318, null, "es")).toBe("ilvl 318");
    expect(formatVaultReward(null, "Myth", "es")).toBeNull();
  });
});
