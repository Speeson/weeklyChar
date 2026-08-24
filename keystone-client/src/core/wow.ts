import { coreRequest } from "./client";
import type { SelectWowAccountsPayload, SelectWowInstallPayload, WowState } from "./types";

export function detectWow(): Promise<WowState> {
  return coreRequest<WowState>("wow.detect");
}

export function listWowAccounts(): Promise<WowState> {
  return coreRequest<WowState>("wow.list_accounts");
}

export function selectWowInstall(payload: SelectWowInstallPayload): Promise<WowState> {
  return coreRequest<WowState>("wow.select_install", payload);
}

export function selectWowAccounts(payload: SelectWowAccountsPayload): Promise<WowState> {
  return coreRequest<WowState>("wow.select_accounts", payload);
}
