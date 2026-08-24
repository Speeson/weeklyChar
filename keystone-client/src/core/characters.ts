import { coreRequest } from "./client";
import { listenCoreEvents } from "./events";
import type { CharacterState } from "./types";

export function getCharacters(): Promise<CharacterState> {
  return coreRequest<CharacterState>("characters.get");
}

export function refreshCharacters(): Promise<CharacterState> {
  return coreRequest<CharacterState>("characters.refresh");
}

export function subscribeToCharacterEvents(callback: (state: CharacterState) => void) {
  return listenCoreEvents((event) => {
    if (event.event === "characters.updated") {
      callback(event.data);
    }
  });
}
