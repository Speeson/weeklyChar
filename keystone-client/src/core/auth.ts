import { coreRequest } from "./client";
import type { AuthState, LoginPayload, RegisterPayload, RegisterResult } from "./types";

export function login(payload: LoginPayload): Promise<AuthState> {
  return coreRequest<AuthState>("auth.login", payload);
}

export function logout(): Promise<AuthState> {
  return coreRequest<AuthState>("auth.logout");
}

export function register(payload: RegisterPayload): Promise<RegisterResult> {
  return coreRequest<RegisterResult>("auth.register", payload);
}
