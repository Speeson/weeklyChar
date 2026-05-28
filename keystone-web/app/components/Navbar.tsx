'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { apiFetch, clearToken, getToken, getUsername, setUsername as saveUsername, getAvatarUrl, setAvatarUrl } from '@/lib/auth'

interface Character {
  id: number
  name: string
  realm: string
  avatarUrl: string | null
  rioScore: number | null
  wowClass: string | null
}

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [username, setUsernameState] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [characters, setCharacters] = useState<Character[] | null>(null)
  const [loadingChars, setLoadingChars] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = getUsername()
    if (stored) {
      setUsernameState(stored)
    } else if (getToken()) {
      apiFetch('/api/me')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.username) {
            saveUsername(data.username)
            setUsernameState(data.username)
          }
          if (data?.avatarUrl) {
            setAvatarUrl(data.avatarUrl)
            setAvatarUrlState(data.avatarUrl)
          }
        })
        .catch(() => {})
    }

    const cached = getAvatarUrl()
    if (cached) setAvatarUrlState(cached)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleOpen(val: boolean) {
    setOpen(val)
    if (val && characters === null && !loadingChars) {
      setLoadingChars(true)
      apiFetch('/api/me/characters')
        .then(r => r.ok ? r.json() : [])
        .then((data: Character[]) => {
          const sorted = [...data].sort((a, b) => (b.rioScore ?? 0) - (a.rioScore ?? 0))
          setCharacters(sorted)
        })
        .catch(() => setCharacters([]))
        .finally(() => setLoadingChars(false))
    }
  }

  async function selectAvatar(char: Character) {
    if (!char.avatarUrl) return
    // Update UI immediately (optimistic)
    setAvatarUrl(char.avatarUrl)
    setAvatarUrlState(char.avatarUrl)
    setOpen(false)
    // Persist to server in background
    try {
      await apiFetch('/api/me/avatar', {
        method: 'PATCH',
        body: JSON.stringify({ avatarUrl: char.avatarUrl }),
      })
    } catch {}
  }

  function logout() {
    clearToken()
    router.push('/login')
  }

  const charsWithAvatars = (characters ?? []).filter(c => c.avatarUrl)

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm transition ${
        pathname === href
          ? 'text-yellow-400 font-semibold'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 backdrop-blur px-8 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">

        <div className="flex items-center gap-8">
          <span className="text-yellow-400 font-bold text-xl tracking-tight">⚔ KeystoneSync</span>
          {navLink('/', 'Mis personajes')}
          {navLink('/teams', 'Equipos')}
        </div>

        {/* Profile dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => handleOpen(!open)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-7 h-7 rounded-full object-cover border border-gray-600 flex-shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            <span className="text-sm text-gray-300 max-w-[120px] truncate">{username}</span>
            <svg
              className={`w-3 h-3 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-600 flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-500">Conectado como</p>
                  <p className="text-sm font-semibold text-white truncate">{username}</p>
                </div>
              </div>

              {/* Avatar picker — always visible */}
              <div className="px-3 py-2.5 border-b border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Foto de perfil</p>
                {loadingChars ? (
                  <p className="text-[11px] text-gray-500 italic">Cargando...</p>
                ) : charsWithAvatars.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {charsWithAvatars.map(char => (
                      <button
                        key={char.id}
                        title={`${char.name} — ${char.rioScore ? Math.round(char.rioScore) : 'Sin score'}`}
                        onClick={() => selectAvatar(char)}
                        className={`rounded-full overflow-hidden border-2 transition-all ${
                          avatarUrl === char.avatarUrl
                            ? 'border-yellow-400 scale-110'
                            : 'border-gray-700 hover:border-gray-500'
                        }`}
                      >
                        <img
                          src={char.avatarUrl!}
                          alt={char.name}
                          className="w-9 h-9 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-600 leading-tight">
                    Sincroniza tus personajes desde el cliente para elegir avatar.
                  </p>
                )}
              </div>

              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  Perfil
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  Ajustes
                </Link>
              </div>
              <div className="border-t border-gray-800 py-1">
                <button
                  onClick={logout}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
