import { API_BASE_URL } from './api-config'
import { currentSessionGeneration } from './session-generation'

export async function csrfFetch(
  input: string,
  init: RequestInit,
  allowExpiredLogout = false,
): Promise<Response> {
  const generation = currentSessionGeneration()
  const response = await fetch(`${API_BASE_URL}/auth/csrf`, { credentials: 'include' })
  if (generation !== currentSessionGeneration()) throw new Error('Session changed')
  if (allowExpiredLogout && response.status === 401)
    return fetch(input, { ...init, credentials: 'include' })
  if (!response.ok) throw new Error(`Unable to verify session (HTTP ${response.status})`)
  const payload: unknown = await response.json()
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('token' in payload) ||
    typeof payload.token !== 'string'
  ) {
    throw new Error('Invalid CSRF response')
  }
  if (generation !== currentSessionGeneration()) throw new Error('Session changed')
  const headers = new Headers(init.headers)
  headers.set('X-CSRF-Token', payload.token)
  return fetch(input, { ...init, credentials: 'include', headers })
}
