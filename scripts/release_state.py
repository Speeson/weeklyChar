from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ReleaseState:
    name: str
    should_prepare: bool
    should_publish: bool
    reason: str


def determine_release_state(
    *,
    pending_changesets: bool,
    tag_exists: bool,
    release_exists: bool,
    asset_exists: bool,
) -> ReleaseState:
    if pending_changesets:
        if tag_exists and release_exists and asset_exists:
            return ReleaseState("complete", False, False, "Expected release and asset already exist.")
        if tag_exists:
            return ReleaseState("resume", False, True, "Release commit/tag already exist; resume publication.")
        if release_exists:
            return ReleaseState(
                "inconsistent",
                False,
                False,
                "Pending changesets exist but the expected release exists without the expected tag.",
            )
        return ReleaseState("fresh", True, True, "Prepare a new release from pending changesets.")

    if tag_exists and release_exists and asset_exists:
        return ReleaseState("complete", False, False, "Expected release and asset already exist.")

    if tag_exists and not release_exists:
        return ReleaseState("resume", False, True, "Tag exists but the GitHub Release is missing.")

    if tag_exists and release_exists and not asset_exists:
        return ReleaseState("resume", False, True, "Release exists but the expected asset is missing.")

    if release_exists and not tag_exists:
        return ReleaseState("inconsistent", False, False, "Release exists without the expected tag.")

    return ReleaseState("inconsistent", False, False, "No pending changesets and no resumable release state.")
