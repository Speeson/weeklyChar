export function snapshotArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function snapshotRecords<T extends object>(value: unknown): T[] {
  return snapshotArray<unknown>(value).filter(
    (entry): entry is T => typeof entry === "object" && entry !== null && !Array.isArray(entry),
  );
}
