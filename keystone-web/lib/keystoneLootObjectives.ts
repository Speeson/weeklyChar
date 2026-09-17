export type KeystoneLootVoidcoreState =
  | 'pending'
  | 'completed_with_voidcore'
  | 'voidcore_not_checked'

export type KeystoneLootObjective = {
  itemId: number
  itemName: string | null
  upgradeTrack?: string | null
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
  voidcoreState: KeystoneLootVoidcoreState
  owned?: boolean
}

export type OwnerObjectivesStatus =
  | 'available'
  | 'empty'
  | 'not_installed'
  | 'not_ready'
  | 'unsupported'
  | 'unavailable'

export type ObjectiveSnapshot = {
  updatedAt: number
  addonVersion: string
  apiVersion: 2
  voidcoreChecked: boolean
}

export type OwnerObjectivesResponse = {
  status: OwnerObjectivesStatus
  snapshot: ObjectiveSnapshot | null
  objectives: KeystoneLootObjective[]
  nextCursor: string | null
}

export type TeamObjectivesStatus =
  | 'available'
  | 'sharing_disabled'
  | 'no_keystoneloot'
  | 'unsupported'
  | 'no_targets'

export type TeamObjectivesAvailableResponse = {
  status: 'available'
  updatedAt: number
  objectives: KeystoneLootObjective[]
  nextCursor: string | null
}

export type TeamObjectivesResponse = TeamObjectivesAvailableResponse | {
  status: Exclude<TeamObjectivesStatus, 'available'>
}

export type ObjectiveFilters = {
  dungeonId: number | null
  specId: number | null
  cursor?: string | null
}

export type ObjectiveRequestIdentity = {
  characterId: number
  dungeonId: number | null
  specId: number | null
  cursor: string | null
  generation: number
}

export type TeamObjectiveRequestIdentity = {
  teamId: number
  characterId: number
  dungeonId: number | null
  specId: number | null
  cursor: string | null
  generation: number
}

const STATUSES: readonly OwnerObjectivesStatus[] = [
  'available', 'empty', 'not_installed', 'not_ready', 'unsupported', 'unavailable',
]

const VOIDCORE_STATES: readonly KeystoneLootVoidcoreState[] = [
  'pending', 'completed_with_voidcore', 'voidcore_not_checked',
]

const TEAM_STATUSES: readonly TeamObjectivesStatus[] = [
  'available', 'sharing_disabled', 'no_keystoneloot', 'unsupported', 'no_targets',
]

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

function nullableString(value: unknown, maximum: number): value is string | null {
  return value === null || (typeof value === 'string' && value.length > 0 && value.length <= maximum)
}

function statNames(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 32
    && value.every(name => typeof name === 'string' && name.length > 0 && name.length <= 128)
    && new Set(value).size === value.length
}

function parseSnapshot(value: unknown): ObjectiveSnapshot | null {
  if (!isObject(value) || !Number.isSafeInteger(value.updatedAt) || Number(value.updatedAt) < 0
    || typeof value.addonVersion !== 'string' || value.addonVersion.length === 0
    || value.addonVersion.length > 64 || value.apiVersion !== 2
    || typeof value.voidcoreChecked !== 'boolean') return null
  return {
    updatedAt: Number(value.updatedAt),
    addonVersion: value.addonVersion,
    apiVersion: 2,
    voidcoreChecked: value.voidcoreChecked,
  }
}

function parseObjective(value: unknown): KeystoneLootObjective | null {
  if (!isObject(value) || !positiveInteger(value.itemId) || !nullableString(value.itemName, 512)
    || !nullableString(value.iconUrl, 2048) || !positiveInteger(value.tier)
    || !positiveInteger(value.specId) || typeof value.sourceType !== 'string'
    || value.sourceType.length === 0 || value.sourceType.length > 64
    || !(positiveInteger(value.sourceId)
      || (typeof value.sourceId === 'string' && value.sourceId.length > 0 && value.sourceId.length <= 128))
    || !(value.slotId === null || Number.isSafeInteger(value.slotId))
    || !nullableString(value.slotName, 128)
    || !nullableString(value.itemClassName, 128)
    || !nullableString(value.itemSubClassName, 128)
    || !statNames(value.statNames)
    || !(value.upgradeTrack === undefined || value.upgradeTrack === null || (typeof value.upgradeTrack === 'string' && value.upgradeTrack.length > 0 && value.upgradeTrack.length <= 64))
    || !(value.owned === undefined || typeof value.owned === 'boolean')
    || typeof value.voidcoreState !== 'string'
    || !VOIDCORE_STATES.includes(value.voidcoreState as KeystoneLootVoidcoreState)) return null

  if (value.iconUrl !== null) {
    try {
      if (new URL(value.iconUrl as string).protocol !== 'https:') return null
    } catch {
      return null
    }
  }

  const objective: KeystoneLootObjective = {
    itemId: value.itemId,
    itemName: value.itemName,
    ...(typeof value.upgradeTrack === 'string' ? { upgradeTrack: value.upgradeTrack } : {}),
    iconUrl: value.iconUrl,
    tier: value.tier,
    specId: value.specId,
    sourceType: value.sourceType,
    sourceId: value.sourceId,
    slotId: value.slotId as number | null,
    slotName: value.slotName,
    itemClassName: value.itemClassName,
    itemSubClassName: value.itemSubClassName,
    statNames: [...value.statNames],
    voidcoreState: value.voidcoreState as KeystoneLootVoidcoreState,
  }
  if (value.owned === true) objective.owned = true
  return objective
}

export function parseOwnerObjectivesResponse(value: unknown): OwnerObjectivesResponse | null {
  if (!isObject(value) || typeof value.status !== 'string'
    || !STATUSES.includes(value.status as OwnerObjectivesStatus)
    || !Array.isArray(value.objectives)
    || !(value.nextCursor === null || (typeof value.nextCursor === 'string'
      && value.nextCursor.length > 0 && value.nextCursor.length <= 2048))) return null

  const status = value.status as OwnerObjectivesStatus
  const objectives = value.objectives.map(parseObjective)
  if (objectives.some(objective => objective === null)) return null
  const snapshot = value.snapshot === null ? null : parseSnapshot(value.snapshot)
  if (value.snapshot !== null && !snapshot) return null
  if ((status === 'available' || status === 'empty') && !snapshot) return null
  if (status === 'empty' && objectives.length !== 0) return null
  if (status !== 'available' && status !== 'empty'
    && (snapshot !== null || objectives.length !== 0 || value.nextCursor !== null)) return null

  return {
    status,
    snapshot,
    objectives: objectives as KeystoneLootObjective[],
    nextCursor: value.nextCursor,
  }
}

export function parseTeamObjectivesResponse(value: unknown): TeamObjectivesResponse | null {
  if (!isObject(value) || typeof value.status !== 'string'
    || !TEAM_STATUSES.includes(value.status as TeamObjectivesStatus)) return null

  const status = value.status as TeamObjectivesStatus
  if (status !== 'available') {
    if ('updatedAt' in value || 'objectives' in value || 'nextCursor' in value) return null
    return { status }
  }

  if (!Number.isSafeInteger(value.updatedAt) || Number(value.updatedAt) < 0
    || !Array.isArray(value.objectives)
    || !(value.nextCursor === null || (typeof value.nextCursor === 'string'
      && value.nextCursor.length > 0 && value.nextCursor.length <= 2048))) return null

  const objectives = value.objectives.map(parseObjective)
  if (objectives.some(objective => objective === null)) return null
  return {
    status: 'available',
    updatedAt: Number(value.updatedAt),
    objectives: objectives as KeystoneLootObjective[],
    nextCursor: value.nextCursor,
  }
}

export function tierPresentation(tier: number): { label: string, tone: string } {
  if (tier === 3) return { label: 'Best in Slot', tone: 'border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200' }
  if (tier === 2) return { label: 'Must have', tone: 'border-red-400/40 bg-red-500/10 text-red-200' }
  if (tier === 1) return { label: 'Nice to have', tone: 'border-sky-400/40 bg-sky-500/10 text-sky-200' }
  if (tier === 5) return { label: 'Catalyst', tone: 'border-amber-400/40 bg-amber-500/10 text-amber-200' }
  if (tier === 4) return { label: 'Transmog', tone: 'border-violet-400/40 bg-violet-500/10 text-violet-200' }
  return { label: `Prioridad ${tier}`, tone: 'border-gray-600 bg-gray-800 text-gray-200' }
}

export function objectiveItemName(objective: Pick<KeystoneLootObjective, 'itemId' | 'itemName'>): string {
  return objective.itemName ?? `Objeto #${objective.itemId}`
}

function normalizedMetadata(value: string | null): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function includesMetadata(value: string, terms: string[]): boolean {
  return terms.some(term => value.includes(term))
}

export function compactItemSlotLabel(objective: Pick<KeystoneLootObjective, 'slotId' | 'slotName' | 'itemClassName' | 'itemSubClassName'>): string | null {
  const itemClass = normalizedMetadata(objective.itemClassName)
  const subClass = normalizedMetadata(objective.itemSubClassName)
  const oneHand = includesMetadata(subClass, ['one-handed', 'one handed', 'una mano'])
  const twoHand = includesMetadata(subClass, ['two-handed', 'two handed', 'dos manos'])
  const hand = oneHand ? '1M ' : twoHand ? '2M ' : ''
  let weapon: string | null = null
  if (includesMetadata(subClass, ['sword', 'espada'])) weapon = `${hand}Esp.`
  else if (includesMetadata(subClass, ['mace', 'maza'])) weapon = `${hand}Maza`
  else if (includesMetadata(subClass, ['axe', 'hacha'])) weapon = `${hand}Hacha`
  else if (includesMetadata(subClass, ['polearm', 'arma de asta', 'armas de asta'])) weapon = 'Arm. Asta'
  else if (includesMetadata(subClass, ['staff', 'staves', 'baculo', 'baston'])) weapon = 'Bastón'
  else if (includesMetadata(subClass, ['dagger', 'daga'])) weapon = 'Daga'
  else if (includesMetadata(subClass, ['fist weapon', 'arma de puno', 'armas de puno'])) weapon = 'Puño'
  else if (includesMetadata(subClass, ['crossbow', 'ballesta'])) weapon = 'Ballesta'
  else if (includesMetadata(subClass, ['bow', 'arco'])) weapon = 'Arco'
  else if (includesMetadata(subClass, ['gun', 'arma de fuego', 'armas de fuego'])) weapon = 'Fusil'
  else if (includesMetadata(subClass, ['wand', 'varita'])) weapon = 'Varita'
  else if (includesMetadata(subClass, ['shield', 'escudo'])) weapon = 'Escudo'
  if (weapon && (itemClass === 'arma' || includesMetadata(itemClass, ['weapon']) || objective.slotId === 16 || objective.slotId === 17)) return weapon

  const slot = normalizedMetadata(objective.slotName)
  const slots: Array<[string[], string]> = [
    [['head', 'cabeza'], 'Cabeza'], [['neck', 'cuello'], 'Cuello'], [['shoulder', 'hombro'], 'Hombros'],
    [['back', 'cloak', 'cape', 'espalda', 'capa'], 'Espalda'], [['chest', 'robe', 'pecho', 'torso'], 'Pecho'],
    [['wrist', 'muneca'], 'Muñec.'], [['main hand', 'mano principal'], 'Mano ppal.'], [['off hand', 'mano secundaria'], 'Mano sec.'],
    [['hands', 'gloves', 'manos'], 'Manos'], [['waist', 'cintura'], 'Cintura'],
    [['legs', 'piernas'], 'Piernas'], [['feet', 'pies'], 'Pies'], [['finger', 'ring', 'dedo', 'anillo'], 'Anillo'],
    [['trinket', 'abalorio'], 'Abal.'],
  ]
  const matched = slots.find(([terms]) => includesMetadata(slot, terms))
  if (matched) return matched[1]
  const fallback: Record<number, string> = {
    1: 'Cabeza', 2: 'Cuello', 3: 'Hombros', 5: 'Pecho', 6: 'Cintura', 7: 'Piernas', 8: 'Pies',
    9: 'Muñec.', 10: 'Manos', 11: 'Anillo', 12: 'Anillo', 13: 'Abal.', 14: 'Abal.', 15: 'Espalda',
    16: 'Mano ppal.', 17: 'Mano sec.',
  }
  return objective.slotId === null ? null : fallback[objective.slotId] ?? null
}

export function objectiveSourceLabel(
  objective: Pick<KeystoneLootObjective, 'sourceType' | 'sourceId'>,
  dungeonNames: ReadonlyMap<number, string> = new Map(),
): string {
  if (objective.sourceType === 'dungeon' && typeof objective.sourceId === 'number') {
    return dungeonNames.get(objective.sourceId) ?? `Mazmorra ${objective.sourceId}`
  }
  if (objective.sourceType === 'raid') return `Banda · fuente ${objective.sourceId}`
  if (objective.sourceType === 'catalyst') return 'Catalyst'
  if (objective.sourceType === 'custom') return 'Personalizado'
  return `${objective.sourceType} · ${objective.sourceId}`
}

export function voidcorePresentation(state: KeystoneLootVoidcoreState): { label: string, tone: string } {
  if (state === 'completed_with_voidcore') {
    return { label: 'Completado con Voidcore', tone: 'text-emerald-300' }
  }
  if (state === 'voidcore_not_checked') {
    return { label: 'Estado de Voidcore sin verificar', tone: 'text-gray-400' }
  }
  return { label: 'Pendiente', tone: 'text-yellow-300' }
}

export function objectiveStatePresentation(objective: Pick<KeystoneLootObjective, 'owned' | 'voidcoreState'>): { label: string, tone: string } {
  if (objective.owned) return { label: 'Ya lo tienes', tone: 'text-emerald-300' }
  return voidcorePresentation(objective.voidcoreState)
}

export function ownerObjectiveStatusMessage(status: OwnerObjectivesStatus): string | null {
  if (status === 'empty') return 'No hay objetivos de KeystoneLoot para estos filtros.'
  if (status === 'not_installed') return 'KeystoneLoot no está instalado para este personaje.'
  if (status === 'not_ready') return 'KeystoneLoot todavía no ha generado sus objetivos para este personaje.'
  if (status === 'unsupported') return 'La versión instalada de KeystoneLoot no es compatible.'
  if (status === 'unavailable') return 'No hay datos de KeystoneLoot disponibles para este personaje.'
  return null
}

export function teamObjectiveStatusMessage(status: TeamObjectivesStatus): string | null {
  if (status === 'sharing_disabled') return 'Este miembro no comparte sus objetivos de KeystoneLoot con el equipo.'
  if (status === 'no_keystoneloot') return 'No hay datos de KeystoneLoot disponibles para este personaje.'
  if (status === 'unsupported') return 'La versión de KeystoneLoot de este personaje no es compatible.'
  if (status === 'no_targets') return 'No hay objetivos para esta mazmorra y especialización.'
  return null
}

export function teamObjectiveRequestErrorMessage(reason: unknown): string {
  return reason instanceof Error && !(reason instanceof TypeError)
    ? reason.message
    : 'No se pudieron cargar los objetivos.'
}

export function formatObjectiveFreshness(updatedAt: number, now = Math.floor(Date.now() / 1000)) {
  const age = Math.max(0, now - updatedAt)
  const relative = age < 60
    ? 'Actualizado ahora'
    : age < 3600
      ? `Actualizado hace ${Math.floor(age / 60)} min`
      : age < 86400
        ? `Actualizado hace ${Math.floor(age / 3600)} h`
        : `Actualizado hace ${Math.floor(age / 86400)} d`
  const stale = age > 86400
  return {
    relative,
    exact: new Date(updatedAt * 1000).toLocaleString('es-ES'),
    stale,
    warning: stale ? 'Puede estar desactualizado' : null,
  }
}

export function buildOwnerObjectivesPath(characterId: number, filters: ObjectiveFilters): string {
  const query = new URLSearchParams({ limit: '50' })
  if (filters.dungeonId !== null) {
    query.set('sourceType', 'dungeon')
    query.set('sourceId', String(filters.dungeonId))
  }
  if (filters.specId !== null) query.set('specId', String(filters.specId))
  if (filters.cursor) query.set('cursor', filters.cursor)
  return `/api/me/characters/${characterId}/keystone-loot/objectives?${query.toString()}`
}

export function buildTeamObjectivesPath(
  teamId: number,
  characterId: number,
  filters: ObjectiveFilters,
): string {
  const query = new URLSearchParams({ limit: '50' })
  if (filters.dungeonId !== null) query.set('challengeMapId', String(filters.dungeonId))
  if (filters.specId !== null) query.set('specId', String(filters.specId))
  if (filters.cursor) query.set('cursor', filters.cursor)
  return `/api/teams/${teamId}/characters/${characterId}/keystone-loot/objectives?${query.toString()}`
}

export function createObjectiveRequestIdentity(
  characterId: number,
  dungeonId: number | null,
  specId: number | null,
  cursor: string | null,
  generation: number,
): ObjectiveRequestIdentity {
  return { characterId, dungeonId, specId, cursor, generation }
}

export function isObjectiveRequestCurrent(
  request: ObjectiveRequestIdentity,
  current: ObjectiveRequestIdentity | null,
): boolean {
  return current !== null
    && request.characterId === current.characterId
    && request.dungeonId === current.dungeonId
    && request.specId === current.specId
    && request.cursor === current.cursor
    && request.generation === current.generation
}

export function createTeamObjectiveRequestIdentity(
  teamId: number,
  characterId: number,
  dungeonId: number | null,
  specId: number | null,
  cursor: string | null,
  generation: number,
): TeamObjectiveRequestIdentity {
  return { teamId, characterId, dungeonId, specId, cursor, generation }
}

export function isTeamObjectiveRequestCurrent(
  request: TeamObjectiveRequestIdentity,
  current: TeamObjectiveRequestIdentity | null,
): boolean {
  return current !== null
    && request.teamId === current.teamId
    && request.characterId === current.characterId
    && request.dungeonId === current.dungeonId
    && request.specId === current.specId
    && request.cursor === current.cursor
    && request.generation === current.generation
}

export function mergeObjectivePages(
  previous: OwnerObjectivesResponse | null,
  next: OwnerObjectivesResponse,
  append: boolean,
): OwnerObjectivesResponse {
  if (!append || !previous || next.status !== 'available') return next
  return { ...next, objectives: [...previous.objectives, ...next.objectives] }
}

export function mergeTeamObjectivePages(
  previous: TeamObjectivesResponse | null,
  next: TeamObjectivesResponse,
  append: boolean,
): TeamObjectivesResponse {
  if (!append || previous?.status !== 'available' || next.status !== 'available') return next
  return { ...next, objectives: [...previous.objectives, ...next.objectives] }
}

export function characterObjectiveTitle(character: { name: string, realm: string }): string {
  return `${character.name} — ${character.realm}`
}
