import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentUser, login, logout } from '@/services/auth-api'
import { useAuthStore } from '../auth'

vi.mock('@/services/auth-api', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

describe('auth store', () => {
  const user = { id: 1, name: 'Tester', email: 'tester@example.test' }

  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
  })

  it('restores a session and marks initialization complete', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user)
    const store = useAuthStore()

    await store.initialize()

    expect(store.user).toEqual(user)
    expect(store.initialized).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('marks an unauthenticated session as initialized', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const store = useAuthStore()

    await store.initialize()

    expect(store.user).toBeNull()
    expect(store.initialized).toBe(true)
  })

  it('reports initialization errors and completes the initial check', async () => {
    const failure = new Error('Network error')
    vi.mocked(getCurrentUser).mockRejectedValue(failure)
    const store = useAuthStore()

    await expect(store.initialize()).rejects.toBe(failure)
    expect(store.error).toBe('Network error')
    expect(store.initialized).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('signs in and stores the returned user', async () => {
    vi.mocked(login).mockResolvedValue(user)
    const store = useAuthStore()

    await store.signIn(user.email, 'password')

    expect(login).toHaveBeenCalledExactlyOnceWith(user.email, 'password')
    expect(store.user).toEqual(user)
    expect(store.error).toBeNull()
  })

  it('reports sign-in errors and rethrows them', async () => {
    const failure = new Error('Invalid credentials')
    vi.mocked(login).mockRejectedValue(failure)
    const store = useAuthStore()

    await expect(store.signIn(user.email, 'wrong')).rejects.toBe(failure)
    expect(store.error).toBe('Invalid credentials')
    expect(store.loading).toBe(false)
  })

  it('clears the user only after logout succeeds', async () => {
    const store = useAuthStore()
    store.user = user
    vi.mocked(logout).mockResolvedValue()

    await store.signOut()

    expect(logout).toHaveBeenCalledOnce()
    expect(store.user).toBeNull()
  })

  it('preserves the user and reports an error when logout fails', async () => {
    const failure = new Error('Logout failed')
    vi.mocked(logout).mockRejectedValue(failure)
    const store = useAuthStore()
    store.user = user

    await expect(store.signOut()).rejects.toBe(failure)
    expect(store.user).toEqual(user)
    expect(store.error).toBe('Logout failed')
    expect(store.loading).toBe(false)
  })
})
