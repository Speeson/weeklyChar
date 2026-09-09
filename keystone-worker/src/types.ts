export type Env = {
  DB: D1Database
  JWT_SECRET: string
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
  WEB_BASE_URL?: string
  ALLOWED_ORIGINS?: string
  BLIZZARD_CLIENT_ID?: string
  BLIZZARD_CLIENT_SECRET?: string
  BATTLENET_REDIRECT_URI?: string
  WORKER_SMOKE_BYPASS_TOKEN?: string
}

export type WowItemMetadataRow = {
  region: string
  locale: string
  item_id: number
  name: string | null
  icon_url: string | null
  slot_name: string | null
  item_class_name: string | null
  item_subclass_name: string | null
  stat_names_json: string | null
  stat_groups_json: string | null
  quality_type: string | null
  status: string
  fetched_at: number
  refresh_after: number
}

export type UserRow = {
  id: number
  username: string
  password_hash: string | null
  sync_token: string
  avatar_url: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  date_of_birth: string | null
  email_verified: number
  email_verification_token_hash: string | null
  email_verification_expires_at: string | null
  password_reset_token_hash: string | null
  password_reset_expires_at: string | null
  share_keystone_loot_with_teams: number
  created_at: string
}

export type UserIdentityRow = {
  id: number
  user_id: number
  provider: 'battlenet'
  provider_subject: string
  provider_display_name: string
  created_at: string
  last_login_at: string | null
}

export type OAuthFlowRow = {
  id: string
  intent: 'login_web' | 'login_desktop' | 'link_account'
  state_hash: string | null
  pkce_verifier: string | null
  initiator_user_id: number | null
  desktop_poll_secret_hash: string | null
  handoff_secret_hash: string | null
  provider_subject: string | null
  provider_display_name: string | null
  result_user_id: number | null
  status: 'pending' | 'needs_onboarding' | 'ready' | 'consumed' | 'failed'
  expires_at: string
  handoff_expires_at: string | null
  created_at: string
  completed_at: string | null
}

export type CharacterRow = {
  id: number
  user_id: number
  name: string
  realm: string
  region: string
  avatar_url: string | null
  wow_account: string | null
  rio_score: number | null
  wow_class: string | null
  ilvl: number | null
  vault_json: string | null
  prey_hunts_json: string | null
  currencies_json: string | null
  money_json: string | null
  mythic_plus_season_json: string | null
  equipment_json: string | null
  talents_json: string | null
  omnium_folio_json: string | null
  keystone_loot_json: string | null
  created_at: string
  updated_at: string
}

export type KeystoneRow = {
  id: number
  character_id: number
  has_keystone: number
  keystone_level: number | null
  keystone_challenge_map_id: number | null
  keystone_map_id: number | null
  keystone_dungeon: string | null
  updated_reason: string | null
  updated_at: number | null
  created_at: string
}

export type TeamRow = {
  id: number
  name: string
  invite_code: string
  created_by: number
  created_at: string
}

export type TeamInvitationRow = {
  id: number
  team_id: number
  invited_user_id: number
  invited_by_user_id: number
  status: string
  created_at: string
  expires_at: string
  responded_at: string | null
}
