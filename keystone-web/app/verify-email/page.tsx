'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { API_URL } from '@/lib/auth'

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verificando tu email...')

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setStatus('error')
      setMessage('Link de verificacion invalido.')
      return
    }

    fetch(`${API_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail ?? 'No se pudo verificar el email.')
        setStatus('success')
        setMessage(data.message ?? 'Email verificado correctamente.')
      })
      .catch(error => {
        setStatus('error')
        setMessage(error.message)
      })
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-gray-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b121b] p-7 text-center shadow-2xl shadow-black/50">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">KeystoneSync</p>
        <h1 className="mt-2 text-2xl font-black text-white">Verificacion de email</h1>
        <p className={`mt-5 text-sm ${status === 'success' ? 'text-green-300' : status === 'error' ? 'text-red-300' : 'text-gray-300'}`}>
          {message}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-lg bg-yellow-500 px-5 py-2.5 text-sm font-black text-gray-950 transition hover:bg-yellow-400"
        >
          Ir a iniciar sesion
        </Link>
      </div>
    </main>
  )
}
