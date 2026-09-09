import type { AuthState, BattleNetDesktopPoll } from "./types";

export type BattleNetFlowResult =
  | { status: "ready"; auth: AuthState }
  | { status: "expired" | "consumed" | "cancelled" };

export async function pollBattleNetUntilComplete(options: {
  expiresAt: string;
  poll: () => Promise<BattleNetDesktopPoll>;
  wait?: (milliseconds: number) => Promise<void>;
  cancelled: () => boolean;
  onNeedsOnboarding?: () => void;
}): Promise<BattleNetFlowResult> {
  const expiresAt = Date.parse(options.expiresAt);
  if (!Number.isFinite(expiresAt)) throw new Error("Invalid Battle.net expiration.");
  const wait = options.wait ?? ((milliseconds) => new Promise(resolve => window.setTimeout(resolve, milliseconds)));
  let onboardingReported = false;
  while (Date.now() < expiresAt) {
    if (options.cancelled()) return { status: "cancelled" };
    await wait(2_000);
    if (options.cancelled()) return { status: "cancelled" };
    const result = await options.poll();
    if (result.status === "needs_onboarding") {
      if (!onboardingReported) options.onNeedsOnboarding?.();
      onboardingReported = true;
      continue;
    }
    if (result.status === "pending") continue;
    if (result.status === "ready") {
      if (!result.auth?.authenticated) throw new Error("Invalid KeystoneSync session.");
      return { status: "ready", auth: result.auth };
    }
    return { status: result.status };
  }
  return { status: "expired" };
}
