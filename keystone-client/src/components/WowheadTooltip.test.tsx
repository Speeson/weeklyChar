import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WowheadSpellIcon } from "./WowheadTooltip";

describe("WowheadSpellIcon", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads a large source texture so Planner capability icons remain sharp", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ icon: "spell_nature_bloodlust" }),
    }));

    const { container } = render(<WowheadSpellIcon className="test-icon" spellId={987_654} />);

    await waitFor(() => expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://wow.zamimg.com/images/wow/icons/large/spell_nature_bloodlust.jpg",
    ));
  });
});
