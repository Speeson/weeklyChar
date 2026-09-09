import { coreRequest } from "./client";
import type { AuthState, BattleNetDesktopPoll, BattleNetDesktopStart, LoginPayload, RegisterPayload, RegisterResult } from "./types";

export function login(payload: LoginPayload): Promise<AuthState> {
  return coreRequest<AuthState>("auth.login", payload);
}

export function logout(): Promise<AuthState> {
  return coreRequest<AuthState>("auth.logout");
}

export function register(payload: RegisterPayload): Promise<RegisterResult> {
  return coreRequest<RegisterResult>("auth.register", payload);
}

export function startBattleNetLogin(): Promise<BattleNetDesktopStart> {
  return coreRequest<BattleNetDesktopStart>("auth.battlenet.start");
}

export function pollBattleNetLogin(): Promise<BattleNetDesktopPoll> {
  return coreRequest<BattleNetDesktopPoll>("auth.battlenet.poll");
}

export function cancelBattleNetLogin(): Promise<{ status: "cancelled" }> {
  return coreRequest<{ status: "cancelled" }>("auth.battlenet.cancel");
}
