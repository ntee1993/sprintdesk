import { afterEach, describe, expect, it, vi } from 'vitest'
import { csrfFetch } from '../csrf-fetch'
import { invalidateSessionGeneration } from '../session-generation'

afterEach(() => vi.unstubAllGlobals())
describe('CSRF fetch', () => {
  it('retrieves a token before sending an authenticated mutation', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'csrf-value' }) })
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', mock)
    await csrfFetch('http://localhost:3000/tasks/1', { method: 'DELETE' })
    expect(mock).toHaveBeenNthCalledWith(1, 'http://localhost:3000/auth/csrf', {
      credentials: 'include',
    })
    const [url, init] = mock.mock.calls[1]!
    expect(url).toBe('http://localhost:3000/tasks/1')
    expect(init.method).toBe('DELETE')
    expect(init.credentials).toBe('include')
    expect((init.headers as Headers).get('X-CSRF-Token')).toBe('csrf-value')
  })
  it('does not send the mutation when the token request fails', async () => {
    const mock = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    vi.stubGlobal('fetch', mock)
    await expect(csrfFetch('http://localhost:3000/tasks/1', { method: 'DELETE' })).rejects.toThrow(
      'Unable to verify session',
    )
    expect(mock).toHaveBeenCalledOnce()
  })
  it('allows logout to clear an expired session after a token 401 without retrying', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 204 })
    vi.stubGlobal('fetch', mock)
    await csrfFetch('http://localhost:3000/auth/logout', { method: 'POST' }, true)
    expect(mock).toHaveBeenCalledTimes(2)
    expect(mock).toHaveBeenLastCalledWith('http://localhost:3000/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  })
  it('does not retry a failed mutation', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'csrf-value' }) })
      .mockResolvedValueOnce({ ok: false, status: 403 })
    vi.stubGlobal('fetch', mock)
    const response = await csrfFetch('http://localhost:3000/tasks/1', { method: 'DELETE' })
    expect(response.status).toBe(403)
    expect(mock).toHaveBeenCalledTimes(2)
  })
  it('does not reuse an earlier session token for another concurrent mutation', async () => {
    let resolveOld!: (value: unknown) => void
    const oldResponse = new Promise((resolve) => {
      resolveOld = resolve
    })
    const mock = vi
      .fn()
      .mockReturnValueOnce(oldResponse)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'new-session-token' }) })
      .mockImplementation(async (_url: string, init: RequestInit) => ({
        status: (init.headers as Headers).get('X-CSRF-Token') === 'new-session-token' ? 200 : 403,
      }))
    vi.stubGlobal('fetch', mock)
    const oldMutation = csrfFetch('http://localhost:3000/tasks/1', { method: 'DELETE' })
    invalidateSessionGeneration()
    const newMutation = csrfFetch('http://localhost:3000/tasks/2', { method: 'DELETE' })
    expect((await newMutation).status).toBe(200)
    resolveOld({ ok: true, json: async () => ({ token: 'old-session-token' }) })
    await expect(oldMutation).rejects.toThrow('Session changed')
    expect(mock).toHaveBeenCalledTimes(3)
  })
})
