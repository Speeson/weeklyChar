export const KEYSTONE_LOOT_LIMITS = {
  serializedBytes: 256 * 1024,
  favorites: 2000,
  usedItems: 2000,
  bonusIds: 64,
  gems: 64,
  addonVersionLength: 64,
  characterKeyLength: 128,
  sourceIdLength: 128,
  sourceTypeLength: 64,
} as const

type JsonObject = Record<string, unknown>

const STATE_FLAGS = {
  not_installed: { installed: false, supported: false },
  installed_not_ready: { installed: true, supported: false },
  unsupported_api: { installed: true, supported: false },
  supported: { installed: true, supported: true },
} as const

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

function isInteger(value: unknown): value is number {
  return Number.isSafeInteger(value)
}

function boundedString(value: unknown, maximum: number): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum
}

function validateIntegerArray(
  value: unknown,
  field: string,
  maximum: number,
  positive: boolean,
): string | null {
  if (!Array.isArray(value)) return `${field} debe ser un array`
  if (value.length > maximum) return `${field} supera el máximo de ${maximum} elementos`
  const valid = positive ? isPositiveInteger : isInteger
  if (!value.every(valid)) return `${field} contiene IDs no válidos`
  return null
}

function validateFavorite(value: unknown, index: number): string | null {
  if (!isObject(value)) return `favorites[${index}] debe ser un objeto`

  const sourceId = value.sourceId
  const sourceIdValid = isPositiveInteger(sourceId)
    || boundedString(sourceId, KEYSTONE_LOOT_LIMITS.sourceIdLength)
  if (!sourceIdValid) return `favorites[${index}].sourceId no es válido`
  if (!isPositiveInteger(value.specId)) return `favorites[${index}].specId no es válido`
  if (!isPositiveInteger(value.itemId)) return `favorites[${index}].itemId no es válido`
  if (!isPositiveInteger(value.tier)) return `favorites[${index}].tier no es válido`

  if (value.sourceType !== undefined
    && !boundedString(value.sourceType, KEYSTONE_LOOT_LIMITS.sourceTypeLength)) {
    return `favorites[${index}].sourceType no es válido`
  }

  for (const field of ['slotId', 'icon', 'enchant'] as const) {
    if (value[field] !== undefined && !isInteger(value[field])) {
      return `favorites[${index}].${field} debe ser un entero`
    }
  }

  if (value.bonusIds !== undefined) {
    const error = validateIntegerArray(
      value.bonusIds,
      `favorites[${index}].bonusIds`,
      KEYSTONE_LOOT_LIMITS.bonusIds,
      false,
    )
    if (error) return error
  }

  if (value.gems !== undefined) {
    const error = validateIntegerArray(
      value.gems,
      `favorites[${index}].gems`,
      KEYSTONE_LOOT_LIMITS.gems,
      false,
    )
    if (error) return error
  }

  return null
}

function validateVoidcore(value: unknown): string | null {
  if (!isObject(value)) return 'voidcore debe ser un objeto'
  if (typeof value.checked !== 'boolean') return 'voidcore.checked debe ser booleano'
  return validateIntegerArray(
    value.usedItems,
    'voidcore.usedItems',
    KEYSTONE_LOOT_LIMITS.usedItems,
    true,
  )
}

export function validateKeystoneLoot(value: unknown): string | null {
  if (!isObject(value)) return 'el bloque debe ser un objeto y no puede ser null'

  const serialized = JSON.stringify(value)
  if (new TextEncoder().encode(serialized).byteLength > KEYSTONE_LOOT_LIMITS.serializedBytes) {
    return 'el bloque supera el tamaño máximo de 256 KiB'
  }

  const state = value.state
  if (typeof state !== 'string' || !(state in STATE_FLAGS)) {
    return 'state no es válido'
  }

  const expectedFlags = STATE_FLAGS[state as keyof typeof STATE_FLAGS]
  if (value.installed !== expectedFlags.installed || value.supported !== expectedFlags.supported) {
    return `installed/supported no son coherentes con state=${state}`
  }

  if (!Array.isArray(value.favorites)) return 'favorites debe ser un array'
  if (value.favorites.length > KEYSTONE_LOOT_LIMITS.favorites) {
    return `favorites supera el máximo de ${KEYSTONE_LOOT_LIMITS.favorites} elementos`
  }
  if (state !== 'supported' && value.favorites.length !== 0) {
    return `favorites debe estar vacío cuando state=${state}`
  }

  if (value.apiVersion !== undefined
    && (!isInteger(value.apiVersion) || Number(value.apiVersion) < 0)) {
    return 'apiVersion debe ser un entero no negativo'
  }
  if (value.addonVersion !== undefined
    && !boundedString(value.addonVersion, KEYSTONE_LOOT_LIMITS.addonVersionLength)) {
    return 'addonVersion no es válido'
  }
  if (value.characterKey !== undefined
    && !boundedString(value.characterKey, KEYSTONE_LOOT_LIMITS.characterKeyLength)) {
    return 'characterKey no es válido'
  }
  if (value.updatedAt !== undefined
    && (!isInteger(value.updatedAt) || Number(value.updatedAt) < 0)) {
    return 'updatedAt debe ser un entero no negativo'
  }

  for (let index = 0; index < value.favorites.length; index += 1) {
    const error = validateFavorite(value.favorites[index], index)
    if (error) return error
  }

  if (value.voidcore !== undefined) {
    const error = validateVoidcore(value.voidcore)
    if (error) return error
  }

  if (state === 'supported') {
    if (value.apiVersion !== 2) return 'supported requiere apiVersion=2'
    if (!boundedString(value.addonVersion, KEYSTONE_LOOT_LIMITS.addonVersionLength)) {
      return 'supported requiere addonVersion'
    }
    if (!boundedString(value.characterKey, KEYSTONE_LOOT_LIMITS.characterKeyLength)) {
      return 'supported requiere characterKey'
    }
    if (!isInteger(value.updatedAt) || Number(value.updatedAt) < 0) {
      return 'supported requiere updatedAt'
    }
    if (value.voidcore === undefined) return 'supported requiere voidcore'
  }

  return null
}
