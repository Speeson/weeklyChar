import { coreRequest } from "./client";
import type { AuthState, LoginPayload } from "./types";

export function login(payload: LoginPayload): Promise<AuthState> {
  return coreRequest<AuthState>("auth.login", payload);
}

export function logout(): Promise<AuthState> {
  return coreRequest<AuthState>("auth.logout");
}
