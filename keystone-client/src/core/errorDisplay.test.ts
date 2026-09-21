import { describe, expect, it } from "vitest";
import { localizedCoreError } from "./errorDisplay";

describe("localized core errors", () => {
  it("uses structured codes instead of raw messages", () => {
    const error = { code: "SYNC_NETWORK_ERROR", message: "Network failed." };
    expect(localizedCoreError(error, "es", "Fallback").message).toBe("No se pudo enviar la sincronización.");
    expect(localizedCoreError(error, "en", "Fallback").message).toBe("The synchronization could not be sent.");
  });

  it("uses the localized caller fallback for unknown and native errors", () => {
    expect(localizedCoreError({ code: "FUTURE_ERROR", message: "Internal detail" }, "es", "Error seguro").message).toBe("Error seguro");
    expect(localizedCoreError(new Error("Internal detail"), "en", "Safe error").message).toBe("Safe error");
  });
});
