'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/app/components/Navbar'
import { apiFetch, getToken } from '@/lib/auth'
import { DEFAULT_SEASON_2_CURRENCY_VISIBILITY, migrateSeason2CurrencyVisibility } from '@/lib/season2Currencies'

type SettingsState = {
  summaryBlocks: Record<string, boolean>
  summaryCurrencies: Record<string, boolean>
  characterOptions: Record<string, boolean>
  teamOptions: Record<string, boolean>
  syncOptions: Record<string, boolean>
  defaultRegion: string
  dateFormat: string
}

const SETTINGS_KEY = 'ks_web_settings'

const DEFAULT_SETTINGS: SettingsState = {
  summaryBlocks: {
    money: true,
    dungeons: true,
    greatVault: true,
    preyHunts: true,
    currencies: true,
  },
  summaryCurrencies: { ...DEFAULT_SEASON_2_CURRENCY_VISIBILITY },
  characterOptions: {
    showCharactersWithoutKeystone: true,
    favoritesFirst: false,
    compactMode: false,
    hideInactiveCharacters: false,
  },
  teamOptions: {
    collapseAccountsByDefault: false,
    sortAccountsByName: true,
    sortCharactersByKeystone: true,
  },
  syncOptions: {
    showLastSync: true,
    showConnectionStatus: true,
  },
  defaultRegion: 'eu',
  dateFormat: 'short',
}

function loadSettings(): SettingsState {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<SettingsState>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      summaryBlocks: { ...DEFAULT_SETTINGS.summaryBlocks, ...(parsed.summaryBlocks ?? {}) },
      summaryCurrencies: migrateSeason2CurrencyVisibility(parsed.summaryCurrencies),
      characterOptions: { ...DEFAULT_SETTINGS.characterOptions, ...(parsed.characterOptions ?? {}) },
      teamOptions: { ...DEFAULT_SETTINGS.teamOptions, ...(parsed.teamOptions ?? {}) },
      syncOptions: { ...DEFAULT_SETTINGS.syncOptions, ...(parsed.syncOptions ?? {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings: SettingsState) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/55 p-5 shadow-xl">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className={`flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-3 transition ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-gray-700'}`}>
      <span>
        <span className="block text-sm font-medium text-gray-100">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-gray-500">{description}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        disabled={disabled}
        className="h-4 w-4 flex-shrink-0 accent-yellow-400"
      />
    </label>
  )
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-3">
      <span className="text-sm font-medium text-gray-100">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-yellow-500"
      >
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function DisabledAction({ label, description }: { label: string; description: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/50 px-4 py-3 opacity-70">
      <p className="text-sm font-medium text-gray-300">{label}</p>
      <p className="mt-0.5 text-xs text-gray-600">{description}</p>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [shareKeystoneLootWithTeams, setShareKeystoneLootWithTeams] = useState<boolean | null>(null)
  const [privacyLoading, setPrivacyLoading] = useState(true)
  const [privacySaving, setPrivacySaving] = useState(false)
  const [privacyError, setPrivacyError] = useState<string | null>(null)

  useEffect(() => {
    if (!getToken()) {
      router.push('/login')
      return
    }
    const loadedSettings = loadSettings()
    setSettings(loadedSettings)
    saveSettings(loadedSettings)
    setLoaded(true)

    const controller = new AbortController()
    apiFetch('/api/me', { signal: controller.signal })
      .then(async res => {
        if (res.status === 401 || res.status === 403) {
          router.push('/login')
          return null
        }
        if (!res.ok) throw new Error(`Profile request failed with status ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (!data) return
        if (typeof data.shareKeystoneLootWithTeams !== 'boolean') {
          throw new Error('Profile response omitted shareKeystoneLootWithTeams')
        }
        setShareKeystoneLootWithTeams(data.shareKeystoneLootWithTeams)
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setPrivacyError('No se pudo cargar la preferencia de privacidad.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setPrivacyLoading(false)
      })

    return () => controller.abort()
  }, [router])

  function update(next: SettingsState) {
    setSettings(next)
    saveSettings(next)
  }

  function toggleGroup(group: keyof Pick<SettingsState, 'summaryBlocks' | 'summaryCurrencies' | 'characterOptions' | 'teamOptions' | 'syncOptions'>, key: string, value: boolean) {
    update({
      ...settings,
      [group]: {
        ...settings[group],
        [key]: value,
      },
    })
  }

  function reset() {
    update(DEFAULT_SETTINGS)
  }

  async function updatePrivacy(nextValue: boolean) {
    if (shareKeystoneLootWithTeams === null || privacySaving) return
    const previousValue = shareKeystoneLootWithTeams
    setShareKeystoneLootWithTeams(nextValue)
    setPrivacySaving(true)
    setPrivacyError(null)

    try {
      const res = await apiFetch('/api/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ shareKeystoneLootWithTeams: nextValue }),
      })
      if (res.status === 401 || res.status === 403) {
        router.push('/login')
        throw new Error('Unauthorized preference update')
      }
      if (!res.ok) throw new Error(`Preference update failed with status ${res.status}`)
      const data = await res.json()
      if (typeof data.shareKeystoneLootWithTeams !== 'boolean') {
        throw new Error('Preference response omitted shareKeystoneLootWithTeams')
      }
      setShareKeystoneLootWithTeams(data.shareKeystoneLootWithTeams)
    } catch {
      setShareKeystoneLootWithTeams(previousValue)
      setPrivacyError('No se pudo guardar. Se ha restaurado el valor anterior.')
    } finally {
      setPrivacySaving(false)
    }
  }

  if (!loaded) return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </main>
    </>
  )

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 px-4 py-8 text-gray-100 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Ajustes</h1>
              <p className="mt-1 text-sm text-gray-500">Preferencias locales de visualización y opciones de cuenta.</p>
            </div>
            <button
              onClick={reset}
              className="w-fit rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-400 transition hover:border-yellow-500/60 hover:text-white"
            >
              Restaurar valores
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Section
                title="KeystoneLoot y privacidad"
                description="Controla cómo se usa tu wishlist de KeystoneLoot al planificar piedras con tus equipos."
              >
                <ToggleRow
                  label="Compartir mi wishlist de KeystoneLoot con mis equipos"
                  description="Permite que KeystoneSync use tus objetivos de KeystoneLoot para recomendar qué personaje y especialización llevar a una piedra. Los objetos de tu wishlist no se muestran directamente a otros miembros."
                  checked={shareKeystoneLootWithTeams ?? false}
                  onChange={updatePrivacy}
                  disabled={privacyLoading || privacySaving || shareKeystoneLootWithTeams === null}
                />
                <div className="min-h-5 px-1 text-xs" aria-live="polite">
                  {privacyLoading && <p className="text-gray-400">Cargando preferencia de cuenta...</p>}
                  {privacySaving && <p className="text-yellow-300">Guardando en tu cuenta...</p>}
                  {!privacyLoading && !privacySaving && privacyError && <p role="alert" className="text-red-300">{privacyError}</p>}
                  {!privacyLoading && !privacySaving && !privacyError && shareKeystoneLootWithTeams !== null && (
                    <p className="text-gray-500">Guardado en tu cuenta. Restaurar valores solo afecta a las preferencias locales.</p>
                  )}
                </div>
              </Section>
            </div>

            <Section title="Resumen" description="Controla qué bloques aparecen en la tabla de resumen.">
              <ToggleRow label="Mostrar Coins" checked={settings.summaryBlocks.money} onChange={value => toggleGroup('summaryBlocks', 'money', value)} />
              <ToggleRow label="Mostrar Dungeons" checked={settings.summaryBlocks.dungeons} onChange={value => toggleGroup('summaryBlocks', 'dungeons', value)} />
              <ToggleRow label="Mostrar Great Vault" checked={settings.summaryBlocks.greatVault} onChange={value => toggleGroup('summaryBlocks', 'greatVault', value)} />
              <ToggleRow label="Mostrar Prey Hunts" checked={settings.summaryBlocks.preyHunts} onChange={value => toggleGroup('summaryBlocks', 'preyHunts', value)} />
              <ToggleRow label="Mostrar Currencies" checked={settings.summaryBlocks.currencies} onChange={value => toggleGroup('summaryBlocks', 'currencies', value)} />
            </Section>

            <Section title="Currencies" description="Activa o desactiva currencies concretas en Resumen.">
              <ToggleRow label="Hero Mistcrest" checked={settings.summaryCurrencies.heroMistcrest} onChange={value => toggleGroup('summaryCurrencies', 'heroMistcrest', value)} />
              <ToggleRow label="Myth Mistcrest" checked={settings.summaryCurrencies.mythMistcrest} onChange={value => toggleGroup('summaryCurrencies', 'mythMistcrest', value)} />
              <ToggleRow label="Venomblight Manaflux" checked={settings.summaryCurrencies.venomblightManaflux} onChange={value => toggleGroup('summaryCurrencies', 'venomblightManaflux', value)} />
              <ToggleRow label="Tidal Spark Dust" checked={settings.summaryCurrencies.tidalSparkDust} onChange={value => toggleGroup('summaryCurrencies', 'tidalSparkDust', value)} />
              <ToggleRow label="Spark of Tides" checked={settings.summaryCurrencies.sparksOfTides} onChange={value => toggleGroup('summaryCurrencies', 'sparksOfTides', value)} />
              <ToggleRow label="Coffer Key Shards" checked={settings.summaryCurrencies.cofferKeyShards} onChange={value => toggleGroup('summaryCurrencies', 'cofferKeyShards', value)} />
              <ToggleRow label="Restored Coffer Key" checked={settings.summaryCurrencies.restoredCofferKey} onChange={value => toggleGroup('summaryCurrencies', 'restoredCofferKey', value)} />
              <ToggleRow label="Nebulous Voidcore" checked={settings.summaryCurrencies.nebulousVoidcore} onChange={value => toggleGroup('summaryCurrencies', 'nebulousVoidcore', value)} />
              <ToggleRow label="Trovehunter's Bounty" checked={settings.summaryCurrencies.trovehuntersBounty} onChange={value => toggleGroup('summaryCurrencies', 'trovehuntersBounty', value)} />
            </Section>

            <Section title="Personajes" description="Preferencias generales para listas de personajes.">
              <ToggleRow label="Mostrar personajes sin piedra" checked={settings.characterOptions.showCharactersWithoutKeystone} onChange={value => toggleGroup('characterOptions', 'showCharactersWithoutKeystone', value)} />
              <ToggleRow label="Favoritos arriba" description="Preparado para cuando añadamos favoritos por personaje." checked={settings.characterOptions.favoritesFirst} onChange={value => toggleGroup('characterOptions', 'favoritesFirst', value)} />
              <ToggleRow label="Modo compacto" checked={settings.characterOptions.compactMode} onChange={value => toggleGroup('characterOptions', 'compactMode', value)} />
              <ToggleRow label="Ocultar personajes inactivos" checked={settings.characterOptions.hideInactiveCharacters} onChange={value => toggleGroup('characterOptions', 'hideInactiveCharacters', value)} />
            </Section>

            <Section title="Equipos" description="Preferencias para la vista compacta de equipos.">
              <ToggleRow label="Cuentas colapsadas por defecto" checked={settings.teamOptions.collapseAccountsByDefault} onChange={value => toggleGroup('teamOptions', 'collapseAccountsByDefault', value)} />
              <ToggleRow label="Ordenar cuentas por nombre" checked={settings.teamOptions.sortAccountsByName} onChange={value => toggleGroup('teamOptions', 'sortAccountsByName', value)} />
              <ToggleRow label="Ordenar personajes por piedra" checked={settings.teamOptions.sortCharactersByKeystone} onChange={value => toggleGroup('teamOptions', 'sortCharactersByKeystone', value)} />
            </Section>

            <Section title="Sincronización" description="Opciones preparadas para cuando expongamos más estado desde la API.">
              <ToggleRow label="Mostrar última sincronización" checked={settings.syncOptions.showLastSync} onChange={value => toggleGroup('syncOptions', 'showLastSync', value)} />
              <ToggleRow label="Mostrar estado de conexión" checked={settings.syncOptions.showConnectionStatus} onChange={value => toggleGroup('syncOptions', 'showConnectionStatus', value)} />
              <DisabledAction label="Copiar sync token" description="Pendiente de endpoint seguro para mostrar o regenerar el token." />
              <DisabledAction label="Regenerar sync token" description="Debe requerir confirmación porque invalida clientes instalados." />
            </Section>

            <Section title="Cuenta" description="Acciones de seguridad y preferencias básicas.">
              <SelectRow
                label="Región por defecto"
                value={settings.defaultRegion}
                onChange={value => update({ ...settings, defaultRegion: value })}
                options={[
                  { value: 'eu', label: 'EU' },
                  { value: 'us', label: 'US' },
                  { value: 'kr', label: 'KR' },
                  { value: 'tw', label: 'TW' },
                ]}
              />
              <SelectRow
                label="Formato de fecha"
                value={settings.dateFormat}
                onChange={value => update({ ...settings, dateFormat: value })}
                options={[
                  { value: 'short', label: 'Corto' },
                  { value: 'long', label: 'Largo' },
                ]}
              />
              <DisabledAction label="Cambiar contraseña" description="Pendiente de endpoint de cambio de contraseña." />
              <DisabledAction label="Cerrar sesión en todos los dispositivos" description="Pendiente de gestión de sesiones/token en backend." />
              <DisabledAction label="Eliminar cuenta" description="Acción destructiva: conviene añadir confirmación fuerte antes de activarla." />
            </Section>
          </div>
        </div>
      </main>
    </>
  )
}
