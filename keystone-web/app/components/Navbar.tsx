'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { clearToken, getUsername } from '@/lib/auth'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    setUsername(getUsername())
  }, [])

  function logout() {
    clearToken()
    router.push('/login')
  }

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
        <div className="flex items-center gap-4">
          {username && (
            <span className="text-sm text-gray-500">@{username}</span>
          )}
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-red-400 transition"
          >
            Salir
          </button>
        </div>
      </div>
    </nav>
  )
}
