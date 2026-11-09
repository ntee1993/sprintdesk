export type AuthUser = {
  id: number
  name: string
  email: string
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(`Login failed (HTTP ${response.status})`)
  }

  return (await response.json()) as AuthUser
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch('http://localhost:3000/auth/me', {
    credentials: 'include',
  })

  if (response.status === 401) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Failed to get current user (HTTP ${response.status})`)
  }

  return (await response.json()) as AuthUser
}

export async function logout(): Promise<void> {
  const response = await fetch('http://localhost:3000/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Logout failed (HTTP ${response.status})`)
  }
}
