import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('API base URL configuration', () => {
  it('defaults to the local API', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    const { API_BASE_URL } = await import('../api-config')
    expect(API_BASE_URL).toBe('http://localhost:3000')
  })

  it('uses the configured URL for authenticated API requests', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/')
    const fetchMock = vi.fn().mockResolvedValue({ status: 401, ok: false })
    vi.stubGlobal('fetch', fetchMock)
    try {
      const { getCurrentUser } = await import('../auth-api')
      await expect(getCurrentUser()).resolves.toBeNull()
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://api.example.test/auth/me', {
        credentials: 'include',
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('uses the configured public API URL without trailing slashes', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test///')
    const { API_BASE_URL } = await import('../api-config')
    expect(API_BASE_URL).toBe('https://api.example.test')
  })
})
