import { DUNGEON_NAME_BY_ID } from '@/lib/season2'
import { specName } from '@/lib/wowSpecs'
import {
  objectiveItemName,
  objectiveSourceLabel,
  tierPresentation,
  objectiveStatePresentation,
  type KeystoneLootObjective,
} from '@/lib/keystoneLootObjectives'
import KeystoneLootItemTooltip from './KeystoneLootItemTooltip'
import UpgradeTrackIcon from './UpgradeTrackIcon'

function OwnedCheck() {
  return <span aria-label="Ya lo tienes" className="absolute bottom-0 left-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_0_2px_rgba(3,10,6,0.9),0_0_8px_rgba(49,233,129,0.75)]">
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
  </span>
}

function ItemIcon({ objective }: { objective: KeystoneLootObjective }) {
  if (objective.iconUrl) {
    return (
      <span className="relative h-11 w-11 shrink-0">
        <span role="img" aria-label={`Icono de ${objectiveItemName(objective)}`} className={`block h-11 w-11 rounded border border-gray-700 bg-cover bg-center ${objective.owned ? 'grayscale opacity-40' : ''}`} style={{ backgroundImage: `url(${objective.iconUrl})` }} />
        <UpgradeTrackIcon track={objective.upgradeTrack} className="absolute left-0 top-0" />
        {objective.owned && <OwnedCheck />}
      </span>
    )
  }

  return (
    <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded border border-gray-700 bg-gray-900 ${objective.owned ? 'text-gray-700' : 'text-gray-500'}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.5">
        <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
      </svg>
      <UpgradeTrackIcon track={objective.upgradeTrack} className="absolute left-0 top-0" />
      {objective.owned && <OwnedCheck />}
    </span>
  )
}

export default function KeystoneLootObjectiveList({
  objectives,
  showContext = true,
}: {
  objectives: KeystoneLootObjective[]
  showContext?: boolean
}) {
  return (
    <ul className="overflow-hidden rounded border border-gray-800 bg-gray-900/40">
      {objectives.map((objective, index) => {
        const tier = tierPresentation(objective.tier)
        const state = objectiveStatePresentation(objective)
        return (
          <li key={`${objective.itemId}-${objective.specId}-${objective.sourceType}-${objective.sourceId}-${index}`} className={`border-b border-gray-800 last:border-0 ${objective.owned ? 'bg-gray-950/50 text-gray-500' : ''}`}>
            <KeystoneLootItemTooltip
              objective={objective}
              triggerClassName="flex w-full gap-3 px-4 py-4 text-left hover:bg-gray-800/30"
            >
              <ItemIcon objective={objective} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className={`min-w-0 break-words font-medium ${objective.owned ? 'text-gray-400' : 'text-gray-100'}`}>{objectiveItemName(objective)}</p>
                  <span className={`shrink-0 rounded border px-2 py-0.5 text-xs ${objective.owned ? 'border-gray-700 bg-gray-900 text-gray-500' : tier.tone}`}>{tier.label}</span>
                </div>
                {showContext && (
                  <p className="mt-1 break-words text-xs text-gray-400">
                    {objectiveSourceLabel(objective, DUNGEON_NAME_BY_ID)} · {specName(objective.specId)} · objeto {objective.itemId}
                    {objective.slotId !== null ? ` · ranura ${objective.slotId}` : ''}
                  </p>
                )}
                <p className={`mt-1 text-xs ${state.tone}`}>{state.label}</p>
              </div>
            </KeystoneLootItemTooltip>
          </li>
        )
      })}
    </ul>
  )
}
