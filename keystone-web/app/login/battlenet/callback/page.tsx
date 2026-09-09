'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthPageShell from '@/app/components/AuthPageShell'
import { exchangeBattleNetTicket } from '@/lib/battlenet'
import { clearToken, hydrateProfile, setToken } from '@/lib/auth'

const errors: Record<string, string> = {
  cancelled: 'Has cancelado el acceso con Battle.net.',
  authorization_failed: 'La autorizacion de Battle.net no es valida.',
  unavailable: 'Battle.net no esta disponible temporalmente.',
  provider_error: 'Battle.net no pudo completar la autorizacion.',
  already_linked: 'Esta cuenta Battle.net ya esta vinculada.',
}

function CallbackContent() {
  const params = useSearchParams()
  const router = useRouter()
  const error = params.get('error')
  const ticket = params.get('ticket')
  const [message, setMessage] = useState(
    error ? (errors[error] ?? 'No se pudo completar el acceso con Battle.net.')
      : ticket ? 'Completando el acceso seguro...'
        : 'La autorizacion de Battle.net no es valida.',
  )

  useEffect(() => {
    if (error || !ticket) return

    let active = true
    exchangeBattleNetTicket(ticket).then(async payload => {
      if (!active) return
      if (payload.status === 'needs_onboarding') {
        router.replace(`/login/battlenet/onboarding?ticket=${encodeURIComponent(ticket)}`)
        return
      }
      if (payload.status !== 'ready' || typeof payload.accessToken !== 'string') throw new Error()
      setToken(payload.accessToken)
      await hydrateProfile()
      router.replace('/dashboard')
    }).catch(() => {
      clearToken()
      if (active) setMessage('No se pudo completar el acceso con Battle.net.')
    })
    return () => { active = false }
  }, [error, ticket, router])

  return <p aria-live="polite" className="text-sm text-gray-300">{message}</p>
}

export default function BattleNetCallbackPage() {
  return <AuthPageShell eyebrow="Battle.net" title="Iniciar sesion"><Suspense><CallbackContent /></Suspense></AuthPageShell>
}
