import { describe, expect, it } from "vitest";
import { currentVault, currentVaultWeekKey } from "./vaultWeek";

describe("Great Vault weekly reset", () => {
  it("switches weeks on Wednesday at 04:00 UTC", () => {
    const before = Date.parse("2026-10-07T03:59:59Z");
    const after = Date.parse("2026-10-07T04:00:00Z");
    expect(currentVaultWeekKey(before)).toBe("2026-09-30");
    expect(currentVaultWeekKey(after)).toBe("2026-10-07");
    expect(currentVault({ weekKey: "2026-09-30", dungeons: {} }, before)).not.toBeNull();
    expect(currentVault({ weekKey: "2026-09-30", dungeons: {} }, after)).toBeNull();
    expect(currentVault({ dungeons: {} }, after)).toBeNull();
  });
});
