'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { API_URL } from '@/lib/auth'
import AuthPageShell from '@/app/components/AuthPageShell'

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
    <AuthPageShell eyebrow="Cuenta" title="Verificacion de email">
      <div className="text-center">
        <p className={`text-sm ${status === 'success' ? 'text-green-300' : status === 'error' ? 'text-red-300' : 'text-gray-300'}`}>
          {message}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-lg bg-yellow-500 px-5 py-2.5 text-sm font-black text-gray-950 transition hover:bg-yellow-400"
        >
          Ir a iniciar sesion
        </Link>
      </div>
    </AuthPageShell>
  )
}
