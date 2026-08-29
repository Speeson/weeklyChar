import { DUNGEON_NAME_BY_ID } from '@/lib/season2'
import { specName } from '@/lib/wowSpecs'
import {
  objectiveItemName,
  objectiveSourceLabel,
  tierPresentation,
  voidcorePresentation,
  type KeystoneLootObjective,
} from '@/lib/keystoneLootObjectives'

function ItemIcon({ objective }: { objective: KeystoneLootObjective }) {
  if (objective.iconUrl) {
    return (
      <span
        role="img"
        aria-label={`Icono de ${objectiveItemName(objective)}`}
        className="h-11 w-11 shrink-0 rounded border border-gray-700 bg-cover bg-center"
        style={{ backgroundImage: `url(${objective.iconUrl})` }}
      />
    )
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-gray-700 bg-gray-900 text-gray-500">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.5">
        <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
      </svg>
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
        const voidcore = voidcorePresentation(objective.voidcoreState)
        return (
          <li key={`${objective.itemId}-${objective.specId}-${objective.sourceType}-${objective.sourceId}-${index}`} className="flex gap-3 border-b border-gray-800 px-4 py-4 last:border-0">
            <ItemIcon objective={objective} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 break-words font-medium text-gray-100">{objectiveItemName(objective)}</p>
                <span className={`shrink-0 rounded border px-2 py-0.5 text-xs ${tier.tone}`}>{tier.label}</span>
              </div>
              {showContext && (
                <p className="mt-1 break-words text-xs text-gray-400">
                  {objectiveSourceLabel(objective, DUNGEON_NAME_BY_ID)} · {specName(objective.specId)} · objeto {objective.itemId}
                  {objective.slotId !== null ? ` · ranura ${objective.slotId}` : ''}
                </p>
              )}
              <p className={`mt-1 text-xs ${voidcore.tone}`}>{voidcore.label}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
