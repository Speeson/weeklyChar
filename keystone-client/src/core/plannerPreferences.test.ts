import { coreRequest } from "./client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPlannerPreferences, parsePlannerPreferences, updatePlannerPreferences,
} from "./plannerPreferences";

vi.mock("./client", () => ({ coreRequest: vi.fn() }));

const response = { preferences: [{ characterId: 10, specId: 66, role: "tank", playPreference: "preferred", lootSpecId: 65, updatedAt: "2026-09-11T00:00:00.000Z" }] };

describe("Planner preferences core", () => {
  beforeEach(() => vi.mocked(coreRequest).mockReset());

  it("parses all four states and projects only known fields", () => {
    expect(parsePlannerPreferences({ preferences: [
      response.preferences[0],
      { characterId: 10, specId: 65, role: "healer", playPreference: "disabled", lootSpecId: 65, updatedAt: "now", future: true },
    ], token: "secret" }))?.toEqual({ preferences: [
      response.preferences[0],
      { characterId: 10, specId: 65, role: "healer", playPreference: "disabled", lootSpecId: 65, updatedAt: "now" },
    ] });
    expect(parsePlannerPreferences({ preferences: [{ ...response.preferences[0], role: "support" }] })).toBeNull();
    expect(parsePlannerPreferences({ preferences: [{ ...response.preferences[0], playPreference: "sometimes" }] })).toBeNull();
  });

  it("uses dedicated private commands and validates full replacement input", async () => {
    vi.mocked(coreRequest).mockResolvedValue(response);
    await expect(getPlannerPreferences()).resolves.toEqual(response);
    await expect(updatePlannerPreferences([{ characterId: 10, specId: 66, playPreference: "preferred", lootSpecId: 65 }])).resolves.toEqual(response);
    expect(coreRequest).toHaveBeenNthCalledWith(1, "planner.preferences.get");
    expect(coreRequest).toHaveBeenNthCalledWith(2, "planner.preferences.update", { preferences: [{ characterId: 10, specId: 66, playPreference: "preferred", lootSpecId: 65 }] });
    await expect(updatePlannerPreferences([{ characterId: 10, specId: 66, playPreference: "sometimes" as never, lootSpecId: 65 }])).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(coreRequest).toHaveBeenCalledTimes(2);
  });
});
