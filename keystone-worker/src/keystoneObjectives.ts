import { parseSupportedKeystoneLoot, validateKeystoneLoot } from './keystoneLoot'
import type { KeystoneLootFavorite, SupportedKeystoneLootSnapshot } from './keystoneLoot'
import { keystoneLootTierWeight } from './keystoneRecommendations'

export type KeystoneLootObjectiveStatus =
  | 'available'
  | 'empty'
  | 'not_installed'
  | 'not_ready'
  | 'unsupported'
  | 'unavailable'

export type KeystoneLootVoidcoreState =
  | 'pending'
  | 'completed_with_voidcore'
  | 'voidcore_not_checked'

export type KeystoneLootObjectiveDTO = {
  itemId: number
  itemName: string | null
  iconUrl: string | null
  tier: number
  specId: number
  sourceType: string
  sourceId: number | string
  slotId: number | null
  slotName: string | null
  itemClassName: string | null
  itemSubClassName: string | null
  statNames: string[]
  primaryStatNames: string[]
  secondaryStatNames: string[]
  otherStatNames: string[]
  qualityType: string | null
  voidcoreState: KeystoneLootVoidcoreState
}

export type KeystoneLootObjectiveFilters = {
  sourceType?: string
  sourceId?: number | string
  challengeMapId?: number
  specId?: number
  cursor?: string | null
  limit: number
}

export type KeystoneLootObjectivePage = {
  status: KeystoneLootObjectiveStatus
  snapshot: {
    updatedAt: number
    addonVersion: string
    apiVersion: 2
    voidcoreChecked: boolean
  } | null
  objectives: KeystoneLootObjectiveDTO[]
  nextCursor: string | null
}

type ClassifiedSnapshot = {
  status: KeystoneLootObjectiveStatus
  snapshot: SupportedKeystoneLootSnapshot | null
}

function parsedValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

export function classifyKeystoneLootSnapshot(value: unknown): ClassifiedSnapshot {
  const parsed = parsedValue(value)
  if (validateKeystoneLoot(parsed) !== null || !parsed || typeof parsed !== 'object') {
    return { status: 'unavailable', snapshot: null }
  }

  const state = (parsed as { state?: unknown }).state
  if (state === 'not_installed') return { status: 'not_installed', snapshot: null }
  if (state === 'installed_not_ready') return { status: 'not_ready', snapshot: null }
  if (state === 'unsupported_api') return { status: 'unsupported', snapshot: null }

  const snapshot = parseSupportedKeystoneLoot(parsed)
  if (!snapshot) return { status: 'unavailable', snapshot: null }
  return { status: snapshot.favorites.length === 0 ? 'empty' : 'available', snapshot }
}

function sourceKey(sourceId: number | string): string {
  return `${typeof sourceId}:${String(sourceId)}`
}

function effectiveSourceType(favorite: KeystoneLootFavorite): string {
  return favorite.sourceType ?? 'unknown'
}

function displayIdentity(favorite: KeystoneLootFavorite): string {
  return `${favorite.specId}\u0000${effectiveSourceType(favorite)}\u0000${sourceKey(favorite.sourceId)}\u0000${favorite.itemId}`
}

function compareFavoriteRepresentation(left: KeystoneLootFavorite, right: KeystoneLootFavorite): number {
  const weight = keystoneLootTierWeight(right.tier) - keystoneLootTierWeight(left.tier)
  if (weight !== 0) return weight
  if (right.tier !== left.tier) return right.tier - left.tier
  return (right.slotId ?? Number.NEGATIVE_INFINITY) - (left.slotId ?? Number.NEGATIVE_INFINITY)
}

function compareSourceId(left: number | string, right: number | string): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return sourceKey(left).localeCompare(sourceKey(right))
}

function compareFavorites(left: KeystoneLootFavorite, right: KeystoneLootFavorite): number {
  return (left.specId - right.specId)
    || effectiveSourceType(left).localeCompare(effectiveSourceType(right))
    || compareSourceId(left.sourceId, right.sourceId)
    || (left.itemId - right.itemId)
    || (left.tier - right.tier)
}

function filterFingerprint(filters: KeystoneLootObjectiveFilters): string {
  return JSON.stringify({
    sourceType: filters.sourceType ?? null,
    sourceId: filters.sourceId ?? null,
    challengeMapId: filters.challengeMapId ?? null,
    specId: filters.specId ?? null,
    limit: filters.limit,
  })
}

function encodeCursor(offset: number, fingerprint: string): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, offset, fingerprint }))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function decodeCursor(cursor: string | null | undefined, fingerprint: string): number {
  if (!cursor) return 0
  if (cursor.length > 2048) throw new Error('cursor no válido para estos filtros')
  try {
    const normalized = cursor.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
      v?: unknown, offset?: unknown, fingerprint?: unknown
    }
    if (parsed.v !== 1 || !Number.isSafeInteger(parsed.offset) || Number(parsed.offset) < 0
      || parsed.fingerprint !== fingerprint) throw new Error('invalid')
    return Number(parsed.offset)
  } catch {
    throw new Error('cursor no válido para estos filtros')
  }
}

function matchesFilters(favorite: KeystoneLootFavorite, filters: KeystoneLootObjectiveFilters): boolean {
  if (filters.specId !== undefined && favorite.specId !== filters.specId) return false
  if (filters.challengeMapId !== undefined) {
    return favorite.sourceType === 'dungeon'
      && typeof favorite.sourceId === 'number'
      && favorite.sourceId === filters.challengeMapId
  }
  if (filters.sourceType !== undefined && effectiveSourceType(favorite) !== filters.sourceType) return false
  if (filters.sourceId !== undefined && String(favorite.sourceId) !== String(filters.sourceId)) return false
  return true
}

export function buildKeystoneLootObjectivePage(
  value: unknown,
  filters: KeystoneLootObjectiveFilters,
): KeystoneLootObjectivePage {
  const classified = classifyKeystoneLootSnapshot(value)
  const snapshot = classified.snapshot
  if (!snapshot) {
    return { status: classified.status, snapshot: null, objectives: [], nextCursor: null }
  }

  const selected = new Map<string, KeystoneLootFavorite>()
  for (const favorite of snapshot.favorites) {
    if (!matchesFilters(favorite, filters)) continue
    const identity = displayIdentity(favorite)
    const existing = selected.get(identity)
    if (!existing || compareFavoriteRepresentation(favorite, existing) < 0) {
      selected.set(identity, favorite)
    }
  }

  const ordered = [...selected.values()].sort(compareFavorites)
  const fingerprint = filterFingerprint(filters)
  const offset = decodeCursor(filters.cursor, fingerprint)
  if (offset > ordered.length) throw new Error('cursor fuera de rango')
  const page = ordered.slice(offset, offset + filters.limit)
  const nextOffset = offset + page.length
  const usedItems = snapshot.voidcore.checked ? new Set(snapshot.voidcore.usedItems) : null
  const objectives = page.map<KeystoneLootObjectiveDTO>(favorite => ({
    itemId: favorite.itemId,
    itemName: null,
    iconUrl: null,
    tier: favorite.tier,
    specId: favorite.specId,
    sourceType: effectiveSourceType(favorite),
    sourceId: favorite.sourceId,
    slotId: favorite.slotId ?? null,
    slotName: null,
    itemClassName: null,
    itemSubClassName: null,
    statNames: [],
    primaryStatNames: [],
    secondaryStatNames: [],
    otherStatNames: [],
    qualityType: null,
    voidcoreState: !usedItems
      ? 'voidcore_not_checked'
      : usedItems.has(favorite.itemId) ? 'completed_with_voidcore' : 'pending',
  }))

  return {
    status: ordered.length === 0 ? 'empty' : 'available',
    snapshot: {
      updatedAt: snapshot.updatedAt,
      addonVersion: snapshot.addonVersion,
      apiVersion: snapshot.apiVersion,
      voidcoreChecked: snapshot.voidcore.checked,
    },
    objectives,
    nextCursor: nextOffset < ordered.length ? encodeCursor(nextOffset, fingerprint) : null,
  }
}
