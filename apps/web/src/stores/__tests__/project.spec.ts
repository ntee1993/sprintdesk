import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject, getProjects } from '../../services/projects-api'
import { useProjectStore } from '../project'

vi.mock('../../services/projects-api', () => ({
  getProjects: vi.fn(),
  createProject: vi.fn(),
}))

describe('project store', () => {
  const project = { id: 1, name: 'SprintDesk', ownerId: 1 }

  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
  })

  it('fetches projects and stores them', async () => {
    vi.mocked(getProjects).mockResolvedValue([project])
    const store = useProjectStore()

    await store.fetchProjects()

    expect(getProjects).toHaveBeenCalledOnce()
    expect(store.projects).toEqual([project])
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('reports errors when fetching projects fails', async () => {
    const failure = new Error('Failed to load projects')
    vi.mocked(getProjects).mockRejectedValue(failure)
    const store = useProjectStore()

    await expect(store.fetchProjects()).rejects.toBe(failure)

    expect(store.error).toBe('Failed to load projects')
    expect(store.loading).toBe(false)
  })

  it('adds a created project to the store', async () => {
    vi.mocked(createProject).mockResolvedValue(project)
    const store = useProjectStore()

    await store.addProject('SprintDesk')

    expect(createProject).toHaveBeenCalledExactlyOnceWith('SprintDesk')
    expect(store.projects).toEqual([project])
    expect(store.loading).toBe(false)
  })

  it('clears projects', () => {
    const store = useProjectStore()
    store.projects = [project]
    store.error = 'Previous error'

    store.clearProjects()

    expect(store.projects).toEqual([])
    expect(store.error).toBeNull()
  })
})
