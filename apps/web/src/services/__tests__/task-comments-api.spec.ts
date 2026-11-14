import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTaskComment,
  deleteTaskComment,
  getTaskComments,
  updateTaskComment,
} from '../task-comments-api'

vi.mock('@/services/csrf-fetch', () => ({
  csrfFetch: (url: string, init: RequestInit) => fetch(url, init),
}))

describe('task comments API', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('sends authenticated GET, POST, PATCH and DELETE requests', async () => {
    const comment = {
      id: 2,
      taskId: 1,
      authorId: 7,
      content: 'Hello',
      createdAt: '2026-11-13T09:00:00Z',
      updatedAt: '2026-11-13T09:00:00Z',
      author: { id: 7, name: 'Bob' },
    }
    const mock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [comment] })
      .mockResolvedValueOnce({ ok: true, json: async () => comment })
      .mockResolvedValueOnce({ ok: true, json: async () => comment })
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', mock)
    expect(await getTaskComments(1)).toEqual([comment])
    expect(await createTaskComment(1, 'Hello')).toEqual(comment)
    expect(await updateTaskComment(1, 2, 'Hello')).toEqual(comment)
    await deleteTaskComment(1, 2)
    expect(mock).toHaveBeenNthCalledWith(1, 'http://localhost:3000/tasks/1/comments', {
      credentials: 'include',
    })
    expect(mock).toHaveBeenNthCalledWith(2, 'http://localhost:3000/tasks/1/comments', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello' }),
    })
    expect(mock).toHaveBeenNthCalledWith(3, 'http://localhost:3000/tasks/1/comments/2', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello' }),
    })
    expect(mock).toHaveBeenNthCalledWith(4, 'http://localhost:3000/tasks/1/comments/2', {
      method: 'DELETE',
      credentials: 'include',
    })
  })
  it('rejects unsuccessful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(getTaskComments(1)).rejects.toThrow('HTTP 404')
  })
})
