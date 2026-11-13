import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentUser, login, logout, type AuthUser } from '@/services/auth-api'
import { getProjects, type Project } from '@/services/projects-api'
import { createTask, deleteTask, updateTask } from '@/services/tasks-api'
import type { Task } from '@/types/task'
import { useAuthStore } from '../auth'
import { useProjectStore } from '../project'
import { useTaskStore } from '../task'

vi.mock('@/services/auth-api', () => ({ getCurrentUser: vi.fn(), login: vi.fn(), logout: vi.fn() }))
vi.mock('@/services/projects-api', () => ({ getProjects: vi.fn(), createProject: vi.fn() }))
vi.mock('@/services/tasks-api', () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('session lifecycle', () => {
  const alice = { id: 1, name: 'Alice', email: 'alice@example.test' }
  const bob = { id: 2, name: 'Bob', email: 'bob@example.test' }
  const task: Task = { id: 1, title: 'Old task', status: 'todo', priority: 'high' }
  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
    vi.mocked(logout).mockResolvedValue()
  })

  it('ignores a project fetch completed after logout', async () => {
    const pending = deferred<Project[]>()
    vi.mocked(getProjects).mockReturnValue(pending.promise)
    const auth = useAuthStore()
    auth.user = alice
    const projects = useProjectStore()
    const request = projects.fetchProjects()
    await auth.signOut()
    pending.resolve([{ id: 1, name: 'Alice project', ownerId: 1 }])
    await request
    expect(projects.projects).toEqual([])
    expect(projects.loading).toBe(false)
    expect(projects.error).toBeNull()
  })

  it('ignores a task creation completed after logout', async () => {
    const pending = deferred<Task>()
    vi.mocked(createTask).mockReturnValue(pending.promise)
    const auth = useAuthStore()
    auth.user = alice
    const tasks = useTaskStore()
    const request = tasks.addTask({
      title: task.title,
      status: task.status,
      priority: task.priority,
      projectId: 1,
    })
    await auth.signOut()
    pending.resolve(task)
    await request
    expect(tasks.tasks).toEqual([])
    expect(tasks.isLoading).toBe(false)
  })

  it('ignores an update completed after switching projects', async () => {
    const pending = deferred<Task>()
    vi.mocked(updateTask).mockReturnValue(pending.promise)
    const tasks = useTaskStore()
    tasks.tasks = [task]
    const request = tasks.updateTask(task.id, { title: 'Updated' })
    tasks.clearTasks()
    const projectBTask = { ...task, title: 'Project B' }
    tasks.tasks = [projectBTask]
    pending.resolve({ ...task, title: 'Updated' })
    await request
    expect(tasks.tasks).toEqual([projectBTask])
    expect(tasks.fetchError).toBeNull()
  })

  it('does not publish a delete failure after logout', async () => {
    const pending = deferred<void>()
    vi.mocked(deleteTask).mockReturnValue(pending.promise)
    const auth = useAuthStore()
    auth.user = alice
    const tasks = useTaskStore()
    tasks.tasks = [task]
    const request = tasks.deleteTask(task.id)
    const failure = new Error('Delete failed')
    const rejection = expect(request).rejects.toBe(failure)
    await auth.signOut()
    pending.reject(failure)
    await rejection
    expect(tasks.tasks).toEqual([])
    expect(tasks.fetchError).toBeNull()
    expect(tasks.isLoading).toBe(false)
  })

  it('does not let initialization overwrite a newer login', async () => {
    const pending = deferred<AuthUser | null>()
    vi.mocked(getCurrentUser).mockReturnValue(pending.promise)
    vi.mocked(login).mockResolvedValue(bob)
    const auth = useAuthStore()
    const request = auth.initialize()
    await auth.signIn(bob.email, 'password')
    pending.resolve(alice)
    await request
    expect(auth.user).toEqual(bob)
    expect(auth.initialized).toBe(true)
    expect(auth.loading).toBe(false)
    expect(auth.error).toBeNull()
  })

  it('keeps a newer login loading when old initialization fails', async () => {
    const initialization = deferred<AuthUser | null>()
    const signingIn = deferred<AuthUser>()
    vi.mocked(getCurrentUser).mockReturnValue(initialization.promise)
    vi.mocked(login).mockReturnValue(signingIn.promise)
    const auth = useAuthStore()
    const oldRequest = auth.initialize()
    const failure = new Error('Old session failed')
    const rejection = expect(oldRequest).rejects.toBe(failure)
    const newRequest = auth.signIn(bob.email, 'password')
    initialization.reject(failure)
    await rejection
    expect(auth.loading).toBe(true)
    expect(auth.error).toBeNull()
    signingIn.resolve(bob)
    await newRequest
    expect(auth.user).toEqual(bob)
    expect(auth.loading).toBe(false)
  })

  it('invalidates old requests when the same user signs in again', async () => {
    const pending = deferred<Project[]>()
    vi.mocked(getProjects).mockReturnValue(pending.promise)
    vi.mocked(login).mockResolvedValue(alice)
    const auth = useAuthStore()
    auth.user = alice
    const projects = useProjectStore()
    const request = projects.fetchProjects()
    await auth.signIn(alice.email, 'password')
    pending.resolve([{ id: 1, name: 'Old session', ownerId: alice.id }])
    await request
    expect(projects.projects).toEqual([])
  })

  it('preserves session data when logout fails', async () => {
    const failure = new Error('Logout failed')
    vi.mocked(logout).mockRejectedValue(failure)
    const auth = useAuthStore()
    auth.user = alice
    const projects = useProjectStore()
    projects.projects = [{ id: 1, name: 'Alice project', ownerId: 1 }]
    const tasks = useTaskStore()
    tasks.tasks = [task]
    await expect(auth.signOut()).rejects.toBe(failure)
    expect(auth.user).toEqual(alice)
    expect(projects.projects).toHaveLength(1)
    expect(tasks.tasks).toEqual([task])
    expect(auth.error).toBe('Logout failed')
  })
})
