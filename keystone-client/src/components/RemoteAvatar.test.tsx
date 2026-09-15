import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme as render } from "../test/renderWithTheme";
import { getCachedAvatarSource, removeCachedAvatar } from "../core/avatarCache";
import { RemoteAvatar } from "./RemoteAvatar";

vi.mock("../core/avatarCache", async importOriginal => {
  const original = await importOriginal<typeof import("../core/avatarCache")>();
  return {
    ...original,
    getCachedAvatarSource: vi.fn().mockResolvedValue(null),
    removeCachedAvatar: vi.fn().mockResolvedValue(undefined),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCachedAvatarSource).mockResolvedValue(null);
});

describe("RemoteAvatar", () => {
  it("replaces the remote source with persistent cached bytes", async () => {
    vi.mocked(getCachedAvatarSource).mockResolvedValueOnce("data:image/jpeg;base64,YXZhdGFy");
    render(<RemoteAvatar alt="Jugador" url="https://img.test/avatar.jpg" />);

    expect(screen.getByRole("img", { name: "Jugador" })).toHaveAttribute("src", "https://img.test/avatar.jpg");
    await waitFor(() => expect(screen.getByRole("img", { name: "Jugador" })).toHaveAttribute(
      "src", "data:image/jpeg;base64,YXZhdGFy",
    ));
  });

  it("hides a failed request and retries the unchanged URL when connectivity returns", async () => {
    render(<RemoteAvatar alt="Jugador" url="https://img.test/avatar.jpg" />);
    fireEvent.error(screen.getByRole("img", { name: "Jugador" }));
    expect(screen.queryByRole("img", { name: "Jugador" })).not.toBeInTheDocument();

    await act(async () => window.dispatchEvent(new Event("online")));

    expect(screen.getByRole("img", { name: "Jugador" })).toHaveAttribute("src", "https://img.test/avatar.jpg");
    expect(getCachedAvatarSource).toHaveBeenCalledTimes(2);
  });

  it("resets a previous failure when the avatar URL changes", () => {
    const view = render(<RemoteAvatar alt="Jugador" url="https://img.test/old.jpg" />);
    fireEvent.error(screen.getByRole("img", { name: "Jugador" }));

    view.rerender(<RemoteAvatar alt="Jugador" url="https://img.test/new.jpg" />);

    expect(screen.getByRole("img", { name: "Jugador" })).toHaveAttribute("src", "https://img.test/new.jpg");
  });

  it("discards a corrupt cached source after its image element fails", async () => {
    vi.mocked(getCachedAvatarSource).mockResolvedValueOnce("data:image/jpeg;base64,YmFk");
    render(<RemoteAvatar alt="Jugador" url="https://img.test/avatar.jpg" />);
    await waitFor(() => expect(screen.getByRole("img", { name: "Jugador" }))
      .toHaveAttribute("src", "data:image/jpeg;base64,YmFk"));
    const image = screen.getByRole("img", { name: "Jugador" });
    await act(async () => fireEvent.error(image));

    expect(removeCachedAvatar).toHaveBeenCalledWith("https://img.test/avatar.jpg");
  });

  it("does not render unsafe avatar schemes", () => {
    const { container } = render(<RemoteAvatar url="javascript:alert(1)" />);
    expect(container.querySelector("img")).toBeNull();
  });
});
