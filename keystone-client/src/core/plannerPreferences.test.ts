import { coreRequest } from "./client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPlannerPreferences, parsePlannerPreferences, updatePlannerPreferences } from "./plannerPreferences";

vi.mock("./client", () => ({ coreRequest: vi.fn() }));

const preference = { characterId: 10, specId: 66, role: "tank", playPreference: "preferred", lootSpecId: 65, updatedAt: "2026-09-11T00:00:00.000Z" };
const lootPreference = { characterId: 10, primaryLootSpecId: 65, secondaryLootSpecIds: [70], updatedAt: "2026-09-11T00:00:00.000Z" };
const response = { preferences: [preference], lootPreferences: [lootPreference], onboardingCompleted: true };

describe("Planner preferences core", () => {
  beforeEach(() => vi.mocked(coreRequest).mockReset());

  it("parses separate play and loot preferences and projects only known fields", () => {
    expect(parsePlannerPreferences({ ...response, preferences: [{ ...preference, future: true }], token: "secret" })).toEqual(response);
    expect(parsePlannerPreferences({ ...response, preferences: [{ ...preference, role: "support" }] })).toBeNull();
    expect(parsePlannerPreferences({ ...response, lootPreferences: [{ ...lootPreference, secondaryLootSpecIds: [65] }] })).toBeNull();
  });

  it("leaves every loot specialization unselected for the legacy response shape", () => {
    expect(parsePlannerPreferences({ preferences: [preference] })).toEqual({
      preferences: [preference],
      lootPreferences: [],
      onboardingCompleted: false,
    });
  });

  it("uses the private commands and validates the complete replacement document", async () => {
    const update = {
      preferences: [{ characterId: 10, specId: 66, playPreference: "preferred" as const }],
      lootPreferences: [{ characterId: 10, primaryLootSpecId: 65, secondaryLootSpecIds: [70] }],
      onboardingCompleted: true,
    };
    vi.mocked(coreRequest).mockResolvedValue(response);
    await expect(getPlannerPreferences()).resolves.toEqual(response);
    await expect(updatePlannerPreferences(update)).resolves.toEqual(response);
    expect(coreRequest).toHaveBeenNthCalledWith(1, "planner.preferences.get");
    expect(coreRequest).toHaveBeenNthCalledWith(2, "planner.preferences.update", update);
    await expect(updatePlannerPreferences({ ...update, lootPreferences: [{ ...update.lootPreferences[0], secondaryLootSpecIds: [65] }] })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(updatePlannerPreferences({ ...update, lootPreferences: [] })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(coreRequest).toHaveBeenCalledTimes(2);
  });
});
