export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api-keystonesync.esgarpe.dev'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

export function setToken(token: string) {
  localStorage.setItem('access_token', token)
}

export function getUsername(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('username')
}

export function setUsername(name: string) {
  localStorage.setItem('username', name)
}

export function getAvatarUrl(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('avatar_url')
}

export function setAvatarUrl(url: string) {
  localStorage.setItem('avatar_url', url)
}

export async function hydrateProfile() {
  const res = await apiFetch('/api/me')
  if (res.status === 401 || res.status === 403) return null
  if (!res.ok) {
    throw new Error(`Profile hydration failed with status ${res.status}`)
  }

  const data = await res.json()
  if (data?.username) setUsername(data.username)
  if (data?.avatarUrl) setAvatarUrl(data.avatarUrl)

  return data
}

export function clearToken() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('username')
  localStorage.removeItem('avatar_url')
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
}

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers ?? {}) },
  })
  return res
}
