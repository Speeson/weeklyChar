import type { Language } from "./i18n";

const SECTION = /<!--\s*lang:(es|en)\s*-->([\s\S]*?)(?=<!--\s*lang:(?:es|en)\s*-->|$)/giu;

export function localizedReleaseNotes(notes: string, language: Language): string {
  const sections = new Map<Language, string>();
  for (const match of notes.matchAll(SECTION)) sections.set(match[1].toLowerCase() as Language, match[2].trim());
  if (sections.size > 0) return sections.get(language) ?? (language === "es"
    ? "No hay notas de esta versión disponibles en español."
    : "No English release notes are available for this version.");
  if (language === "es") return notes;
  return notes.trim() ? "No English release notes are available for this version." : "";
}
