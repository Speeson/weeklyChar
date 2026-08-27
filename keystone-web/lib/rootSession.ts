export type RootSessionDependencies = {
  getToken: () => string | null
  hydrateProfile: () => Promise<unknown | null>
  clearToken: () => void
}

export async function resolveRootSession(
  dependencies: RootSessionDependencies,
): Promise<'landing' | 'dashboard'> {
  if (!dependencies.getToken()) return 'landing'

  try {
    const profile = await dependencies.hydrateProfile()
    if (profile) return 'dashboard'

    dependencies.clearToken()
    return 'landing'
  } catch {
    return 'landing'
  }
}

export function createDashboardRedirect(replace: (destination: string) => void) {
  let redirected = false

  return () => {
    if (redirected) return
    redirected = true
    replace('/dashboard')
  }
}
