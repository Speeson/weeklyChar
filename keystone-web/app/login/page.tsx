'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import AuthForm from '@/app/components/AuthForm'

function LoginContent() {
  const params = useSearchParams()
  const initialMode = params.get('mode') === 'register' ? 'register' : 'login'
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-gray-100">
      <div className="w-full max-w-md">
        <h1 className="mb-8 text-center text-3xl font-black text-yellow-400">KeystoneSync</h1>

        <div className="mb-6 flex overflow-hidden rounded border border-gray-800">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-sm font-medium transition ${mode === 'login' ? 'bg-yellow-500 text-gray-900' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
          >
            Iniciar sesion
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2 text-sm font-medium transition ${mode === 'register' ? 'bg-yellow-500 text-gray-900' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
          >
            Registrarse
          </button>
        </div>

        <AuthForm mode={mode} showLabels />
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
