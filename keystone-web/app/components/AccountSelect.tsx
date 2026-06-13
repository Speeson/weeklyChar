'use client'

export const ALL_ACCOUNTS = '__all__'

export interface AccountScopedCharacter {
  wowAccount?: string | null
}

export function accountOptions(characters: AccountScopedCharacter[]) {
  return [...new Set(characters.map(c => c.wowAccount).filter(Boolean) as string[])]
    .sort((a, b) => a.localeCompare(b, 'es'))
}

export function filterByAccount<T extends AccountScopedCharacter>(characters: T[], selectedAccount: string) {
  if (selectedAccount === ALL_ACCOUNTS) return characters
  return characters.filter(c => c.wowAccount === selectedAccount)
}

export default function AccountSelect({
  accounts,
  value,
  onChange,
  className = '',
}: {
  accounts: string[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  if (accounts.length <= 1) return null

  return (
    <label className={`inline-flex items-center gap-2 text-xs text-gray-500 ${className}`}>
      <span>Cuenta</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm font-semibold text-gray-100 outline-none transition hover:border-gray-500 focus:border-yellow-500"
      >
        <option value={ALL_ACCOUNTS}>Todas</option>
        {accounts.map(account => (
          <option key={account} value={account}>{account}</option>
        ))}
      </select>
    </label>
  )
}
