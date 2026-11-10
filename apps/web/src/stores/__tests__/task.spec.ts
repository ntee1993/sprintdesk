import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTaskStore } from '../task'
import type { Task } from '../../types/task'

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

    expect(mockFetch).toHaveBeenCalledExactlyOnceWith('http://localhost:3000/tasks', {
      credentials: 'include',
    })
    expect(store.tasks).toEqual(mockTasks)
    expect(store.isLoading).toBe(false)
    expect(store.fetchError).toBeNull()
  })

  it.each([1, 2])('fetches tasks for project %i with credentials', async (projectId) => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })
    vi.stubGlobal('fetch', mockFetch)

    const store = useTaskStore()
    await store.fetchTasks(projectId)

    expect(mockFetch).toHaveBeenCalledExactlyOnceWith(
      `http://localhost:3000/tasks?projectId=${projectId}`,
      { credentials: 'include' },
    )
  })

  it('should return error, and tasks remain the same', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    vi.stubGlobal('fetch', mockFetch)

    const store = useTaskStore()
    const initialTasks = store.tasks.map((task: Task) => ({ ...task }))
    await store.fetchTasks()

    expect(mockFetch).toHaveBeenCalledExactlyOnceWith('http://localhost:3000/tasks', {
      credentials: 'include',
    })
    expect(store.fetchError).toEqual('Failed to load tasks')
    expect(store.isLoading).toBe(false)
    expect(store.tasks).toEqual(initialTasks)
  })

  it('should handle network errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))

    vi.stubGlobal('fetch', mockFetch)

    const store = useTaskStore()
    const initialTasks = store.tasks.map((task: Task) => ({ ...task }))
    await store.fetchTasks()

    expect(mockFetch).toHaveBeenCalledExactlyOnceWith('http://localhost:3000/tasks', {
      credentials: 'include',
    })
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

  it('keeps the latest project tasks when an older response arrives later', async () => {
    let resolveA!: (response: Response) => void
    let resolveB!: (response: Response) => void
    const responseA = new Promise<Response>((resolve) => {
      resolveA = resolve
    })
    const responseB = new Promise<Response>((resolve) => {
      resolveB = resolve
    })
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(responseA).mockReturnValueOnce(responseB))

    const store = useTaskStore()
    const requestA = store.fetchTasks(1)
    const requestB = store.fetchTasks(2)
    const tasksB = [{ id: 2, title: 'Project B task', status: 'todo', priority: 'high' }]

    resolveB({ ok: true, json: async () => tasksB } as Response)
    await requestB
    expect(store.tasks).toEqual(tasksB)

    resolveA({
      ok: true,
      json: async () => [{ id: 1, title: 'Project A task', status: 'todo', priority: 'high' }],
    } as Response)
    await requestA

    expect(store.tasks).toEqual(tasksB)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })
})

describe('Task Store - update and delete', () => {
  const originalTask: Task = {
    id: 1,
    title: 'Original task',
    status: 'todo',
    priority: 'high',
  }
  const changes = { title: 'Updated task', status: 'done', priority: 'low' } as const

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('replaces the task with the response from the backend after an update', async () => {
    const updatedTask = { ...originalTask, ...changes, title: 'Saved by backend' }
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => updatedTask,
    })
    vi.stubGlobal('fetch', mockFetch)
    const store = useTaskStore()
    store.tasks = [originalTask]

    await store.updateTask(1, changes)

    expect(store.tasks).toEqual([updatedTask])
    expect(mockFetch).toHaveBeenCalledExactlyOnceWith('http://localhost:3000/tasks/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(changes),
    })
    expect(store.isLoading).toBe(false)
  })

  it('keeps the original task when an update fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    const store = useTaskStore()
    store.tasks = [originalTask]

    await expect(store.updateTask(1, changes)).rejects.toThrow('Failed to update task (HTTP 403)')

    expect(store.tasks).toEqual([originalTask])
    expect(store.fetchError).toBe('Failed to update task (HTTP 403)')
    expect(store.isLoading).toBe(false)
  })

  it('removes the task after the delete succeeds', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)
    const store = useTaskStore()
    store.tasks = [originalTask]

    await store.deleteTask(1)

    expect(store.tasks).toEqual([])
    expect(mockFetch).toHaveBeenCalledExactlyOnceWith('http://localhost:3000/tasks/1', {
      method: 'DELETE',
      credentials: 'include',
    })
    expect(store.isLoading).toBe(false)
  })

  it('keeps the task when a delete fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    const store = useTaskStore()
    store.tasks = [originalTask]

    await expect(store.deleteTask(1)).rejects.toThrow('Failed to delete task (HTTP 403)')

    expect(store.tasks).toEqual([originalTask])
    expect(store.fetchError).toBe('Failed to delete task (HTTP 403)')
    expect(store.isLoading).toBe(false)
  })
})
