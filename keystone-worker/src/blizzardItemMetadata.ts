import type { Env, WowItemMetadataRow } from './types'

const POSITIVE_TTL_SECONDS = 30 * 24 * 60 * 60
const NEGATIVE_TTL_SECONDS = 6 * 60 * 60
const MAX_RESPONSE_BYTES = 64 * 1024
const DEFAULT_TIMEOUT_MS = 5000
const MAX_CONCURRENCY = 4
const MAX_TOOLTIP_NAME_LENGTH = 128
const MAX_STAT_NAMES = 32
const DEFAULT_LOCALE = 'es_ES'
const LOCALES = new Set(['es_ES', 'en_US'])
const REGIONS = new Set(['eu', 'us', 'kr', 'tw'])
const QUALITY_TYPES = new Set([
  'POOR', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'ARTIFACT', 'HEIRLOOM',
])
const PRIMARY_STAT_TYPES = new Set([
  'STRENGTH', 'AGILITY', 'INTELLECT', 'STAMINA',
  'STRENGTH_AGILITY_INTELLECT', 'STRENGTH_OR_AGILITY', 'STRENGTH_OR_INTELLECT',
  'AGILITY_OR_INTELLECT',
])
const SECONDARY_STAT_TYPES = new Set([
  'HASTE_RATING', 'CRIT_RATING', 'MASTERY', 'MASTERY_RATING',
  'VERSATILITY', 'VERSATILITY_RATING',
])

type FetchLike = typeof fetch

type MetadataOptions = {
  fetch?: FetchLike
  now?: number
  timeoutMs?: number
  locale?: string
}

type KeystoneLootMetadataTarget = {
  itemId: number
  itemName: string | null
  iconUrl: string | null
  slotName: string | null
  itemClassName: string | null
  itemSubClassName: string | null
  statNames: string[]
  primaryStatNames: string[]
  secondaryStatNames: string[]
  otherStatNames: string[]
  qualityType: string | null
}

type StatGroups = {
  primary: string[]
  secondary: string[]
  other: string[]
}

type BlizzardJson = {
  status: number
  headers: Headers
  value: unknown
}

type TokenEntry = {
  token: string
  expiresAt: number
}

const tokenCache = new Map<string, TokenEntry>()
const tokenRequests = new Map<string, Promise<TokenEntry>>()

export function resetBlizzardTokenCacheForTests(): void {
  tokenCache.clear()
  tokenRequests.clear()
}

export function normalizeBlizzardRegion(region: string | null | undefined): string {
  const normalized = region?.toLowerCase()
  return normalized && REGIONS.has(normalized) ? normalized : 'eu'
}

export function normalizeBlizzardLocale(locale: string | null | undefined): string {
  return locale && LOCALES.has(locale) ? locale : DEFAULT_LOCALE
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error('Blizzard response too large')
  }
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error('Blizzard response too large')
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('Invalid Blizzard JSON')
  }
}

async function timedFetch(
  fetchImpl: FetchLike,
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeTooltipName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > MAX_TOOLTIP_NAME_LENGTH) return null
  return normalized
}

function nestedName(value: unknown): string | null {
  return isRecord(value) ? safeTooltipName(value.name) : null
}

function orderedStatNames(values: unknown[]): string[] {
  const names = new Set<string>()
  for (const value of values) {
    const name = safeTooltipName(value)
    if (!name) continue
    names.add(name)
    if (names.size >= MAX_STAT_NAMES) break
  }
  return [...names].sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
}

function itemStatGroups(value: unknown): StatGroups {
  const empty = { primary: [], secondary: [], other: [] }
  if (!isRecord(value) || !Array.isArray(value.stats)) return empty
  const byName = new Map<string, string>()
  for (const stat of value.stats) {
    if (!isRecord(stat) || !isRecord(stat.type)) continue
    const name = safeTooltipName(stat.type.name)
    const type = typeof stat.type.type === 'string' ? stat.type.type : ''
    if (name && !byName.has(name)) byName.set(name, type)
  }
  const names = orderedStatNames([...byName.keys()])
  return names.reduce<StatGroups>((groups, name) => {
    const type = byName.get(name) ?? ''
    if (PRIMARY_STAT_TYPES.has(type)) groups.primary.push(name)
    else if (SECONDARY_STAT_TYPES.has(type)) groups.secondary.push(name)
    else groups.other.push(name)
    return groups
  }, { primary: [], secondary: [], other: [] })
}

function allStatNames(groups: StatGroups): string[] {
  return orderedStatNames([...groups.primary, ...groups.secondary, ...groups.other])
}

function safeQualityType(value: unknown): string | null {
  return typeof value === 'string' && QUALITY_TYPES.has(value) ? value : null
}

function itemQualityType(value: unknown): string {
  if (!isRecord(value) || !isRecord(value.quality)) return 'UNKNOWN'
  return safeQualityType(value.quality.type) ?? 'UNKNOWN'
}

function safeStatNamesJson(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return null
    return JSON.stringify(orderedStatNames(parsed))
  } catch {
    return null
  }
}

function statNamesFromJson(value: string | null): string[] {
  const normalized = safeStatNamesJson(value)
  return normalized === null ? [] : JSON.parse(normalized) as string[]
}

function safeStatGroupsJson(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value) as unknown
    if (!isRecord(parsed)) return null
    const primary = Array.isArray(parsed.primary) ? orderedStatNames(parsed.primary) : null
    const secondary = Array.isArray(parsed.secondary) ? orderedStatNames(parsed.secondary) : null
    const other = Array.isArray(parsed.other) ? orderedStatNames(parsed.other) : null
    const combined = primary && secondary && other ? [...primary, ...secondary, ...other] : []
    if (!primary || !secondary || !other || combined.length > MAX_STAT_NAMES
      || new Set(combined).size !== combined.length) return null
    return JSON.stringify({ primary, secondary, other })
  } catch {
    return null
  }
}

function statGroupsFromJson(value: string | null, expectedNames: string[]): StatGroups {
  const normalized = safeStatGroupsJson(value)
  if (normalized !== null) {
    const parsed = JSON.parse(normalized) as StatGroups
    const classified = allStatNames(parsed)
    if (classified.length === expectedNames.length && classified.every(name => expectedNames.includes(name))) {
      return parsed
    }
  }
  return { primary: [], secondary: [], other: expectedNames }
}

function needsTooltipBootstrap(row: WowItemMetadataRow): boolean {
  return (row.status === 'ok' || row.status === 'partial')
    && row.name !== null
    && row.icon_url !== null
    && (row.stat_names_json === null || row.stat_groups_json === null || row.quality_type === null)
}

function emptyTooltipColumns(): Pick<WowItemMetadataRow,
  'slot_name' | 'item_class_name' | 'item_subclass_name' | 'stat_names_json'
  | 'stat_groups_json' | 'quality_type'> {
  return {
    slot_name: null,
    item_class_name: null,
    item_subclass_name: null,
    stat_names_json: null,
    stat_groups_json: null,
    quality_type: null,
  }
}

async function getAccessToken(
  env: Env,
  region: string,
  fetchImpl: FetchLike,
  now: number,
  timeoutMs: number,
  force = false,
): Promise<string | null> {
  const clientId = env.BLIZZARD_CLIENT_ID
  const clientSecret = env.BLIZZARD_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const cacheKey = `${region}:${clientId}`
  const cached = tokenCache.get(cacheKey)
  if (!force && cached && cached.expiresAt > now + 60) return cached.token
  if (force) tokenRequests.delete(cacheKey)
  let request = tokenRequests.get(cacheKey)
  if (!request) {
    request = (async () => {
      const response = await timedFetch(fetchImpl, `https://${region}.battle.net/oauth/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      }, timeoutMs)
      const value = await readBoundedJson(response)
      if (!response.ok || !isRecord(value) || typeof value.access_token !== 'string'
        || value.access_token.length === 0 || value.access_token.length > 4096) {
        throw new Error(`Blizzard OAuth failed: ${response.status}`)
      }
      const expiresIn = typeof value.expires_in === 'number' && value.expires_in > 0
        ? Math.min(value.expires_in, 24 * 60 * 60)
        : 3600
      return { token: value.access_token, expiresAt: now + expiresIn }
    })()
    tokenRequests.set(cacheKey, request)
  }
  try {
    const entry = await request
    tokenCache.set(cacheKey, entry)
    return entry.token
  } finally {
    if (tokenRequests.get(cacheKey) === request) tokenRequests.delete(cacheKey)
  }
}

async function gameDataJson(
  env: Env,
  region: string,
  path: string,
  fetchImpl: FetchLike,
  now: number,
  timeoutMs: number,
  locale: string,
): Promise<BlizzardJson | null> {
  let token = await getAccessToken(env, region, fetchImpl, now, timeoutMs)
  if (!token) return null
  const url = `https://${region}.api.blizzard.com${path}?namespace=static-${region}&locale=${locale}`

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await timedFetch(fetchImpl, url, {
      headers: { Authorization: `Bearer ${token}` },
    }, timeoutMs)
    if (response.status === 401 && attempt === 0) {
      token = await getAccessToken(env, region, fetchImpl, now, timeoutMs, true)
      if (!token) return null
      continue
    }
    if (response.status === 404 || response.status === 429 || response.status >= 500) {
      return { status: response.status, headers: response.headers, value: null }
    }
    const value = await readBoundedJson(response)
    return { status: response.status, headers: response.headers, value }
  }
  return null
}

function safeIconUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'render.worldofwarcraft.com') return null
    return parsed.toString()
  } catch {
    return null
  }
}

async function fetchMetadata(
  env: Env,
  region: string,
  itemId: number,
  fetchImpl: FetchLike,
  now: number,
  timeoutMs: number,
  locale: string,
): Promise<WowItemMetadataRow | null> {
  try {
    const item = await gameDataJson(env, region, `/data/wow/item/${itemId}`, fetchImpl, now, timeoutMs, locale)
    if (!item) return null
    if (item.status === 404) {
      return {
        region, locale, item_id: itemId, name: null, icon_url: null,
        ...emptyTooltipColumns(),
        status: 'not_found', fetched_at: now, refresh_after: now + NEGATIVE_TTL_SECONDS,
      }
    }
    if (item.status === 429) {
      const retryAfter = Number(item.headers.get('retry-after'))
      const retrySeconds = Number.isFinite(retryAfter)
        ? Math.min(3600, Math.max(1, Math.floor(retryAfter)))
        : 60
      return {
        region, locale, item_id: itemId, name: null, icon_url: null,
        ...emptyTooltipColumns(),
        status: 'rate_limited', fetched_at: now, refresh_after: now + retrySeconds,
      }
    }
    if (item.status >= 500 || item.status < 200 || item.status >= 300
      || !isRecord(item.value) || item.value.id !== itemId || typeof item.value.name !== 'string'
      || item.value.name.length === 0 || item.value.name.length > 512) return null

    const media = await gameDataJson(env, region, `/data/wow/media/item/${itemId}`, fetchImpl, now, timeoutMs, locale)
    let iconUrl: string | null = null
    if (media && media.status >= 200 && media.status < 300 && isRecord(media.value)
      && media.value.id === itemId && Array.isArray(media.value.assets)) {
      const icon = media.value.assets.find(asset => isRecord(asset) && asset.key === 'icon')
      if (isRecord(icon)) iconUrl = safeIconUrl(icon.value)
    }

    const statGroups = itemStatGroups(item.value.preview_item)
    return {
      region,
      locale,
      item_id: itemId,
      name: item.value.name,
      icon_url: iconUrl,
      slot_name: nestedName(item.value.inventory_type),
      item_class_name: nestedName(item.value.item_class),
      item_subclass_name: nestedName(item.value.item_subclass),
      stat_names_json: JSON.stringify(allStatNames(statGroups)),
      stat_groups_json: JSON.stringify(statGroups),
      quality_type: itemQualityType(item.value),
      status: iconUrl ? 'ok' : 'partial',
      fetched_at: now,
      refresh_after: now + (iconUrl ? POSITIVE_TTL_SECONDS : NEGATIVE_TTL_SECONDS),
    }
  } catch {
    return null
  }
}

async function readCachedMetadata(
  env: Env,
  region: string,
  itemIds: number[],
  locale: string,
): Promise<Map<number, WowItemMetadataRow>> {
  if (itemIds.length === 0) return new Map()
  const placeholders = itemIds.map(() => '?').join(', ')
  const { results } = await env.DB.prepare(`
    SELECT region, locale, item_id, name, icon_url,
      slot_name, item_class_name, item_subclass_name, stat_names_json,
      stat_groups_json, quality_type,
      status, fetched_at, refresh_after
    FROM wow_item_metadata
    WHERE region = ? AND locale = ? AND item_id IN (${placeholders})
  `).bind(region, locale, ...itemIds).all<WowItemMetadataRow>()
  const allowedStatuses = new Set(['ok', 'partial', 'not_found', 'rate_limited'])
  const requested = new Set(itemIds)
  const validated = results.filter(row => {
    if (row.region !== region || row.locale !== locale || !requested.has(row.item_id)
      || !Number.isSafeInteger(row.item_id) || row.item_id <= 0
      || !allowedStatuses.has(row.status)
      || !Number.isSafeInteger(row.fetched_at) || row.fetched_at < 0
      || !Number.isSafeInteger(row.refresh_after) || row.refresh_after < 0
      || (row.name !== null && (typeof row.name !== 'string' || row.name.length === 0 || row.name.length > 512))) {
      return false
    }
    if (row.icon_url !== null && safeIconUrl(row.icon_url) === null) return false
    return true
  })
  return new Map(validated.map(row => [row.item_id, {
    ...row,
    slot_name: safeTooltipName(row.slot_name),
    item_class_name: safeTooltipName(row.item_class_name),
    item_subclass_name: safeTooltipName(row.item_subclass_name),
    stat_names_json: safeStatNamesJson(row.stat_names_json),
    stat_groups_json: safeStatGroupsJson(row.stat_groups_json),
    quality_type: row.quality_type === 'UNKNOWN' ? 'UNKNOWN' : safeQualityType(row.quality_type),
  }]))
}

async function writeMetadata(env: Env, row: WowItemMetadataRow): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO wow_item_metadata (
      region, locale, item_id, name, icon_url,
      slot_name, item_class_name, item_subclass_name, stat_names_json,
      stat_groups_json, quality_type, status, fetched_at, refresh_after
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(region, locale, item_id) DO UPDATE SET
      name = excluded.name,
      icon_url = excluded.icon_url,
      slot_name = excluded.slot_name,
      item_class_name = excluded.item_class_name,
      item_subclass_name = excluded.item_subclass_name,
      stat_names_json = excluded.stat_names_json,
      stat_groups_json = excluded.stat_groups_json,
      quality_type = excluded.quality_type,
      status = excluded.status,
      fetched_at = excluded.fetched_at,
      refresh_after = excluded.refresh_after
  `).bind(
    row.region, row.locale, row.item_id, row.name, row.icon_url,
    row.slot_name, row.item_class_name, row.item_subclass_name, row.stat_names_json,
    row.stat_groups_json, row.quality_type,
    row.status, row.fetched_at, row.refresh_after,
  ).run()
}

async function mapWithConcurrency<T>(
  values: number[],
  concurrency: number,
  worker: (value: number) => Promise<T>,
): Promise<T[]> {
  const results = new Array<T>(values.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next
      next += 1
      results[index] = await worker(values[index])
    }
  }))
  return results
}

export async function enrichKeystoneLootObjectives<T extends KeystoneLootMetadataTarget>(
  env: Env,
  characterRegion: string,
  objectives: T[],
  options: MetadataOptions = {},
): Promise<T[]> {
  if (objectives.length === 0) return objectives
  const region = normalizeBlizzardRegion(characterRegion)
  const now = options.now ?? Math.floor(Date.now() / 1000)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const fetchImpl = options.fetch ?? fetch
  const locale = normalizeBlizzardLocale(options.locale)
  const itemIds = [...new Set(objectives.map(objective => objective.itemId))]
  const cached = await readCachedMetadata(env, region, itemIds, locale)
  const refreshIds = itemIds.filter(itemId => {
    const row = cached.get(itemId)
    return !row || row.refresh_after <= now || needsTooltipBootstrap(row)
  })

  if (env.BLIZZARD_CLIENT_ID && env.BLIZZARD_CLIENT_SECRET) {
    const refreshed = await mapWithConcurrency(refreshIds, MAX_CONCURRENCY, async itemId => ({
      itemId,
      row: await fetchMetadata(env, region, itemId, fetchImpl, now, timeoutMs, locale),
    }))
    for (const result of refreshed) {
      const existing = cached.get(result.itemId)
      if (!result.row) {
        if (existing && existing.status !== 'not_found' && existing.status !== 'rate_limited') {
          const backedOff = {
            ...existing,
            stat_names_json: existing.stat_names_json ?? '[]',
            stat_groups_json: existing.stat_groups_json ?? JSON.stringify({ primary: [], secondary: [], other: [] }),
            quality_type: existing.quality_type ?? 'UNKNOWN',
            refresh_after: now + NEGATIVE_TTL_SECONDS,
          }
          cached.set(result.itemId, backedOff)
          await writeMetadata(env, backedOff)
        }
        continue
      }
      const row = result.row
      const refreshed = row.status === 'partial' && row.icon_url === null && existing?.icon_url
        ? { ...row, icon_url: existing.icon_url, status: 'ok' }
        : row
      const stored = refreshed.status === 'rate_limited' && existing
        && existing.status !== 'not_found' && existing.status !== 'rate_limited'
        ? {
            ...existing,
            stat_names_json: existing.stat_names_json ?? '[]',
            stat_groups_json: existing.stat_groups_json ?? JSON.stringify({ primary: [], secondary: [], other: [] }),
            quality_type: existing.quality_type ?? 'UNKNOWN',
            refresh_after: refreshed.refresh_after,
          }
        : refreshed
      cached.set(stored.item_id, stored)
      await writeMetadata(env, stored)
    }
  }

  return objectives.map(objective => {
    const metadata = cached.get(objective.itemId)
    if (!metadata || metadata.status === 'not_found' || metadata.status === 'rate_limited') return objective
    const statNames = statNamesFromJson(metadata.stat_names_json)
    const statGroups = statGroupsFromJson(metadata.stat_groups_json, statNames)
    return {
      ...objective,
      itemName: metadata.name,
      iconUrl: metadata.icon_url,
      slotName: metadata.slot_name,
      itemClassName: metadata.item_class_name,
      itemSubClassName: metadata.item_subclass_name,
      statNames,
      primaryStatNames: statGroups.primary,
      secondaryStatNames: statGroups.secondary,
      otherStatNames: statGroups.other,
      qualityType: safeQualityType(metadata.quality_type),
    }
  })
}
