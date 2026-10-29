import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTaskStore } from '../task'

describe('Task Store - fetchTasks', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('fetches tasks and updates the store', async () => {
    const mockTasks = [
      { id: 1, title: 'Learn Vue', status: 'todo', priority: 'high' },
      { id: 2, title: 'Learn NestJS', status: 'done', priority: 'medium' },
    ]
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTasks,
    })

    vi.stubGlobal('fetch', mockFetch)

    const store = useTaskStore()
    await store.fetchTasks()

    expect(mockFetch).toHaveBeenCalledExactlyOnceWith('http://localhost:3000/tasks')
    expect(store.tasks).toEqual(mockTasks)
    expect(store.isLoading).toBe(false)
    expect(store.fetchError).toBeNull()
  })

  it('should return error, and tasks remain the same', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    vi.stubGlobal('fetch', mockFetch)

    const store = useTaskStore()
    const initialTasks = store.tasks.map((task) => ({ ...task }))
    await store.fetchTasks()

    expect(mockFetch).toHaveBeenCalledExactlyOnceWith('http://localhost:3000/tasks')
    expect(store.fetchError).toEqual('Failed to load tasks')
    expect(store.isLoading).toBe(false)
    expect(store.tasks).toEqual(initialTasks)
  })

  it('should handle network errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))

    vi.stubGlobal('fetch', mockFetch)

    const store = useTaskStore()
    const initialTasks = store.tasks.map((task) => ({ ...task }))
    await store.fetchTasks()

    expect(mockFetch).toHaveBeenCalledExactlyOnceWith('http://localhost:3000/tasks')
    expect(store.fetchError).toEqual('Failed to load tasks')
    expect(store.isLoading).toBe(false)
    expect(store.tasks).toEqual(initialTasks)
  })

  it('sets loading state while fetching tasks', async () => {
    let resolveRequest!: (response: Response) => void

    const pendingRequest = new Promise<Response>((resolve) => {
      resolveRequest = resolve
    })

    const mockFetch = vi.fn().mockReturnValue(pendingRequest)

    vi.stubGlobal('fetch', mockFetch)

    const store = useTaskStore()
    const fetchPromise = store.fetchTasks()

    expect(store.isLoading).toBe(true)

    resolveRequest({
      ok: true,
      json: async () => [],
    } as Response)

    await fetchPromise

    expect(store.isLoading).toBe(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })
})
