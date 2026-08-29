export class FakeD1Database {
  constructor() {
    this.users = [
      {
        id: 1,
        username: 'tester',
        password_hash: '',
        sync_token: 'sync-token',
        avatar_url: null,
        first_name: null,
        last_name: null,
        email: null,
        date_of_birth: null,
        email_verified: 0,
        email_verification_token_hash: null,
        email_verification_expires_at: null,
        password_reset_token_hash: null,
        password_reset_expires_at: null,
        share_keystone_loot_with_teams: 1,
        created_at: '2026-08-21T00:00:00.000Z',
      },
    ]
    this.characters = []
    this.keystones = []
    this.teams = []
    this.teamMembers = []
    this.nextCharacterId = 1
    this.nextKeystoneId = 1
    this.characterQueryUserIds = []
    this.itemMetadata = []
    this.metadataReadItemIds = []
    this.snapshotReadCharacterIds = []
  }

  prepare(sql) {
    return new FakeD1Statement(this, sql)
  }
}

class FakeD1Statement {
  constructor(db, sql) {
    this.db = db
    this.sql = sql.replace(/\s+/g, ' ').trim()
    this.values = []
  }

  bind(...values) {
    this.values = values
    return this
  }

  async first() {
    const sql = this.sql
    const values = this.values

    if (sql === 'SELECT * FROM users WHERE sync_token = ?') {
      return this.db.users.find(user => user.sync_token === values[0]) ?? null
    }

    if (sql === 'SELECT * FROM users WHERE id = ?') {
      return this.db.users.find(user => user.id === values[0]) ?? null
    }

    if (sql.includes('SELECT * FROM characters WHERE user_id = ? AND name = ? AND realm = ? AND region = ?')) {
      const [userId, name, realm, region] = values
      return this.db.characters.find(character =>
        character.user_id === userId
        && character.name === name
        && character.realm === realm
        && character.region === region
      ) ?? null
    }

    if (sql === 'SELECT * FROM characters WHERE id = ?') {
      return this.db.characters.find(character => character.id === values[0]) ?? null
    }

    if (sql === 'SELECT id, user_id, region FROM characters WHERE id = ?') {
      const character = this.db.characters.find(row => row.id === values[0])
      return character ? { id: character.id, user_id: character.user_id, region: character.region } : null
    }

    if (sql === 'SELECT keystone_loot_json FROM characters WHERE id = ? AND user_id = ?') {
      this.db.snapshotReadCharacterIds.push(values[0])
      const character = this.db.characters.find(row => row.id === values[0] && row.user_id === values[1])
      return character ? { keystone_loot_json: character.keystone_loot_json } : null
    }

    if (sql === 'SELECT * FROM characters WHERE id = ? AND user_id = ?') {
      return this.db.characters.find(character => character.id === values[0] && character.user_id === values[1]) ?? null
    }

    if (sql === 'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?') {
      const [teamId, userId] = values
      const membership = this.db.teamMembers.find(row => row.team_id === teamId && row.user_id === userId)
      return membership ? { id: membership.id } : null
    }

    if (sql === 'SELECT * FROM teams WHERE id = ?') {
      return this.db.teams.find(team => team.id === values[0]) ?? null
    }

    if (sql.includes('SELECT * FROM keystones WHERE character_id = ?')) {
      const [characterId, resetUnix] = values
      const rows = this.db.keystones
        .filter(keystone =>
          keystone.character_id === characterId
          && keystone.has_keystone === 1
          && keystone.keystone_level !== null
          && keystone.updated_at >= resetUnix
        )
        .sort((left, right) =>
          ((right.updated_at ?? 0) - (left.updated_at ?? 0)) || (right.id - left.id)
        )
      return rows[0] ?? null
    }

    throw new Error(`Unhandled FakeD1 first query: ${sql}`)
  }

  async all() {
    const sql = this.sql
    const values = this.values

    if (sql.includes('SELECT * FROM characters WHERE user_id = ? ORDER BY name')) {
      this.db.characterQueryUserIds.push(values[0])
      const results = this.db.characters
        .filter(character => character.user_id === values[0])
        .sort((left, right) => left.name.localeCompare(right.name))
      return { results }
    }

    if (sql.includes('FROM wow_item_metadata') && sql.includes('item_id IN')) {
      const [region, locale, ...itemIds] = values
      this.db.metadataReadItemIds.push([...itemIds])
      return {
        results: this.db.itemMetadata.filter(row =>
          row.region === region && row.locale === locale && itemIds.includes(row.item_id)),
      }
    }

    if (sql.includes('SELECT u.id, u.username FROM team_members tm JOIN users u ON u.id = tm.user_id')) {
      const teamId = values[0]
      const results = this.db.teamMembers
        .filter(membership => membership.team_id === teamId)
        .map(membership => this.db.users.find(user => user.id === membership.user_id))
        .filter(Boolean)
        .map(user => ({ id: user.id, username: user.username }))
        .sort((left, right) => left.username.localeCompare(right.username))
      return { results }
    }

    if (sql.includes('SELECT u.id, u.username, u.share_keystone_loot_with_teams')) {
      const teamId = values[0]
      const results = this.db.teamMembers
        .filter(membership => membership.team_id === teamId)
        .map(membership => this.db.users.find(user => user.id === membership.user_id))
        .filter(Boolean)
        .map(user => ({
          id: user.id,
          username: user.username,
          share_keystone_loot_with_teams: user.share_keystone_loot_with_teams,
        }))
        .sort((left, right) => left.username.localeCompare(right.username))
      return { results }
    }

    throw new Error(`Unhandled FakeD1 all query: ${sql}`)
  }

  async run() {
    const sql = this.sql
    const values = this.values

    if (sql === 'UPDATE users SET share_keystone_loot_with_teams = ? WHERE id = ?') {
      const [enabled, userId] = values
      const target = this.db.users.find(user => user.id === userId)
      if (!target) throw new Error(`Missing user ${userId}`)
      target.share_keystone_loot_with_teams = enabled
      return { meta: { changes: 1 } }
    }

    if (sql.includes('INSERT INTO wow_item_metadata')) {
      const [region, locale, itemId, name, iconUrl, status, fetchedAt, refreshAfter] = values
      const existing = this.db.itemMetadata.find(row =>
        row.region === region && row.locale === locale && row.item_id === itemId)
      const value = {
        region, locale, item_id: itemId, name, icon_url: iconUrl,
        status, fetched_at: fetchedAt, refresh_after: refreshAfter,
      }
      if (existing) Object.assign(existing, value)
      else this.db.itemMetadata.push(value)
      return { meta: { changes: 1 } }
    }

    if (sql === 'INSERT INTO characters (user_id, name, realm, region) VALUES (?, ?, ?, ?)') {
      const [userId, name, realm, region] = values
      const character = {
        id: this.db.nextCharacterId++,
        user_id: userId,
        name,
        realm,
        region,
        avatar_url: null,
        wow_account: null,
        rio_score: null,
        wow_class: null,
        ilvl: null,
        vault_json: null,
        prey_hunts_json: null,
        currencies_json: null,
        money_json: null,
        mythic_plus_season_json: null,
        keystone_loot_json: null,
        created_at: '2026-08-21T00:00:00.000Z',
        updated_at: '2026-08-21T00:00:00.000Z',
      }
      this.db.characters.push(character)
      return { meta: { last_row_id: character.id } }
    }

    if (sql.includes('UPDATE characters SET wow_account = COALESCE')) {
      const [
        wowAccount,
        avatarUrl,
        rioScore,
        wowClass,
        ilvl,
        vaultJson,
        preyHuntsJson,
        currenciesJson,
        moneyJson,
        mythicPlusSeasonJson,
        keystoneLootJson,
        characterId,
      ] = values
      const character = this.db.characters.find(row => row.id === characterId)
      if (!character) throw new Error(`Missing character ${characterId}`)

      assignIfPresent(character, 'wow_account', wowAccount)
      assignIfPresent(character, 'avatar_url', avatarUrl)
      assignIfPresent(character, 'rio_score', rioScore)
      assignIfPresent(character, 'wow_class', wowClass)
      assignIfPresent(character, 'ilvl', ilvl)
      assignIfPresent(character, 'vault_json', vaultJson)
      assignIfPresent(character, 'prey_hunts_json', preyHuntsJson)
      assignIfPresent(character, 'currencies_json', currenciesJson)
      assignIfPresent(character, 'money_json', moneyJson)
      assignIfPresent(character, 'mythic_plus_season_json', mythicPlusSeasonJson)
      assignIfPresent(character, 'keystone_loot_json', keystoneLootJson)
      character.updated_at = '2026-08-21T00:00:00.000Z'
      return { meta: { changes: 1 } }
    }

    if (sql.includes('UPDATE characters SET avatar_url = COALESCE')) {
      const [
        avatarUrl,
        rioScore,
        wowClass,
        ilvl,
        vaultJson,
        preyHuntsJson,
        currenciesJson,
        moneyJson,
        mythicPlusSeasonJson,
        characterId,
      ] = values
      const character = this.db.characters.find(row => row.id === characterId)
      if (!character) throw new Error(`Missing character ${characterId}`)

      assignIfPresent(character, 'avatar_url', avatarUrl)
      assignIfPresent(character, 'rio_score', rioScore)
      assignIfPresent(character, 'wow_class', wowClass)
      assignIfPresent(character, 'ilvl', ilvl)
      assignIfPresent(character, 'vault_json', vaultJson)
      assignIfPresent(character, 'prey_hunts_json', preyHuntsJson)
      assignIfPresent(character, 'currencies_json', currenciesJson)
      assignIfPresent(character, 'money_json', moneyJson)
      assignIfPresent(character, 'mythic_plus_season_json', mythicPlusSeasonJson)
      character.updated_at = '2026-08-21T00:00:00.000Z'
      return { meta: { changes: 1 } }
    }

    if (sql.includes('INSERT INTO keystones')) {
      const [
        characterId,
        keystoneLevel,
        keystoneChallengeMapId,
        keystoneMapId,
        keystoneDungeon,
        updatedReason,
        updatedAt,
      ] = values
      this.db.keystones.push({
        id: this.db.nextKeystoneId++,
        character_id: characterId,
        has_keystone: 1,
        keystone_level: keystoneLevel,
        keystone_challenge_map_id: keystoneChallengeMapId,
        keystone_map_id: keystoneMapId,
        keystone_dungeon: keystoneDungeon,
        updated_reason: updatedReason,
        updated_at: updatedAt,
        created_at: '2026-08-21T00:00:00.000Z',
      })
      return { meta: { changes: 1 } }
    }

    throw new Error(`Unhandled FakeD1 run query: ${sql}`)
  }
}

function assignIfPresent(target, key, value) {
  if (value !== null && value !== undefined) {
    target[key] = value
  }
}
