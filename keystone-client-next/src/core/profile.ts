import { coreRequest } from "./client";
import type { AuthState, SetAvatarPayload } from "./types";

export function setProfileAvatar(payload: SetAvatarPayload): Promise<AuthState> {
  return coreRequest<AuthState>("profile.set_avatar", payload);
}
