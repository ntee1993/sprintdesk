// @vitest-environment jsdom
import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import TasksView from '../TasksView.vue'
import TaskCard from '../../components/TaskCard.vue'
import TaskSummary from '../../components/TaskSummary.vue'
import { useTaskStore } from '../../stores/task'

describe('TasksView', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, options?: RequestInit) =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (url.endsWith('/projects')) {
              return [
                { id: 1, name: 'Project', ownerId: 1 },
                { id: 2, name: 'Other Project', ownerId: 1 },
              ]
            }
            if (url.endsWith('/projects/1/members')) {
              return [{ userId: 2, name: 'Bob', email: 'bob@example.test', role: 'EDITOR' }]
            }
            if (url.endsWith('/projects/2/members')) {
              return [{ userId: 3, name: 'Carol', email: 'carol@example.test', role: 'VIEWER' }]
            }
            if (options?.method === 'POST') {
              return { id: 42, ...JSON.parse(options.body as string) }
            }
            if (options?.method === 'PATCH') {
              return { id: 7, ...JSON.parse(options.body as string) }
            }
            return []
          },
        }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects a task with an empty title', async () => {
    const pinia = createPinia()
    const wrapper = mount(TasksView, {
      global: {
        plugins: [pinia],
      },
    })
    const taskStore = useTaskStore(pinia)
    await flushPromises()
    const initialCount = taskStore.tasks.length

    await wrapper.get('#task-title').setValue('   ')
    await wrapper.get('form').trigger('submit')

    expect(taskStore.tasks.length).toBe(initialCount)
    expect(wrapper.get('#task-title-error').text()).toBe('Task title is required.')
  })

  it('creates a new task with valid input', async () => {
    const pinia = createPinia()
    const wrapper = mount(TasksView, {
      global: {
        plugins: [pinia],
      },
    })
    const taskStore = useTaskStore(pinia)
    await flushPromises()
    const initialCount = taskStore.tasks.length

    await wrapper.get('#task-title').setValue('  Write Unit Tests  ')
    await wrapper.get('#task-status').setValue('in_progress')
    await wrapper.get('#task-priority').setValue('urgent')
    await wrapper.get('form').trigger('submit')

    await flushPromises()
    expect(taskStore.tasks.length).toBe(initialCount + 1)

    expect(taskStore.tasks.at(-1)).toMatchObject({
      id: 42,
      title: 'Write Unit Tests',
      status: 'in_progress',
      priority: 'urgent',
      projectId: 1,
    })
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: 'Write Unit Tests',
        status: 'in_progress',
        priority: 'urgent',
        projectId: 1,
      }),
    })

    const titleInput = wrapper.get('#task-title').element as HTMLInputElement
    expect(titleInput.value).toBe('')
  })

  it('clears validation error when a valid title is entered', async () => {
    const pinia = createPinia()
    const wrapper = mount(TasksView, {
      global: {
        plugins: [pinia],
      },
    })
    const taskStore = useTaskStore(pinia)
    await flushPromises()
    const initialCount = taskStore.tasks.length

    await wrapper.get('#task-title').setValue('   ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('#task-title-error').text()).toBe('Task title is required.')

    await wrapper.get('#task-title').setValue('Fix Validation')
    expect(wrapper.find('#task-title-error').exists()).toBe(false)

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(taskStore.tasks.length).toBe(initialCount + 1)
    expect(taskStore.tasks.at(-1)?.title).toBe('Fix Validation')
  })

  it('loads and displays members of the selected project', async () => {
    const wrapper = mount(TasksView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.get('#task-assignee').text()).toContain('Bob (EDITOR)')
    await wrapper.get('#project-select').setValue('2')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/projects/2/members', {
      credentials: 'include',
    })
    expect(wrapper.get('#task-assignee').text()).toContain('Carol (VIEWER)')
    expect(wrapper.get('#task-assignee').text()).not.toContain('Bob (EDITOR)')
  })

  it('creates a task with the selected numeric assignee ID', async () => {
    const wrapper = mount(TasksView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    await wrapper.get('#task-title').setValue('Assigned task')
    await wrapper.get('#task-assignee').setValue('2')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const taskPostCalls = vi
      .mocked(fetch)
      .mock.calls.filter(
        ([url, options]) => url === 'http://localhost:3000/tasks' && options?.method === 'POST',
      )
    expect(taskPostCalls).toHaveLength(1)

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: 'Assigned task',
        status: 'todo',
        priority: 'high',
        projectId: 1,
        assigneeId: 2,
      }),
    })
  })

  it('sends null when editing a task to be unassigned', async () => {
    const pinia = createPinia()
    const wrapper = mount(TasksView, {
      global: { plugins: [pinia], stubs: { BaseModal: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()
    useTaskStore(pinia).tasks = [
      { id: 7, title: 'Assigned task', status: 'todo', priority: 'high', assigneeId: 2 },
    ]
    await wrapper.vm.$nextTick()

    await wrapper.getComponent(TaskCard).get('button').trigger('click')
    const assigneeSelect = wrapper.get('#draft-assignee').element as HTMLSelectElement
    expect(assigneeSelect.value).toBe('2')

    await wrapper.get('#draft-assignee option').setValue()
    expect(assigneeSelect.selectedOptions[0]?.textContent).toBe('Unassigned')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/tasks/7', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: 'Assigned task',
        status: 'todo',
        priority: 'high',
        assigneeId: null,
      }),
    })
  })

  it('shows and filters tasks from all pages and summarizes the complete project', async () => {
    const projectTasks = Array.from({ length: 112 }, (_, index) => ({
      id: index + 1,
      title: index === 110 ? 'Needle from page two' : `Task ${index + 1}`,
      status: index < 100 ? 'todo' : 'done',
      priority: index === 110 ? 'urgent' : 'high',
      projectId: 1,
    }))
    const mockFetch = vi.fn().mockImplementation(async (input: string) => {
      const url = new URL(input)
      if (url.pathname === '/projects') {
        return { ok: true, json: async () => [{ id: 1, name: 'Project', ownerId: 1 }] }
      }
      if (url.pathname === '/projects/1/members') {
        return { ok: true, json: async () => [] }
      }
      if (url.pathname === '/tasks') {
        const page = Number(url.searchParams.get('page') ?? 1)
        const limit = Number(url.searchParams.get('limit') ?? 10)
        const start = (page - 1) * limit
        return { ok: true, json: async () => projectTasks.slice(start, start + limit) }
      }
      throw new Error(`Unexpected request: ${input}`)
    })
    vi.stubGlobal('fetch', mockFetch)

    const wrapper = mount(TasksView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    const taskRequests = mockFetch.mock.calls
      .map(([input]) => new URL(input as string))
      .filter((url) => url.pathname === '/tasks')
    expect(taskRequests.map((url) => url.searchParams.get('page'))).toEqual(['1', '2'])
    expect(taskRequests.every((url) => url.searchParams.get('projectId') === '1')).toBe(true)
    expect(wrapper.get('.task-list').text()).toContain('Needle from page two')
    expect(wrapper.getComponent(TaskSummary).text()).toContain('Total Tasks: 112')
    expect(wrapper.getComponent(TaskSummary).text()).toContain('To Do: 100')
    expect(wrapper.getComponent(TaskSummary).text()).toContain('Completed: 12')
    expect(wrapper.getComponent(TaskSummary).text()).toContain('Urgent: 1')
    expect(wrapper.get('.task-board').text()).toContain('Done (12)')

    await wrapper.get('#task-search').setValue('needle')
    await wrapper.get('#task-filter').setValue('done')

    expect(wrapper.get('.task-list').text()).toContain('Needle from page two')
    expect(wrapper.get('.task-list').text()).not.toContain('Task 1 -')
    expect(wrapper.getComponent(TaskSummary).text()).toContain('Total Tasks: 112')
  })

  it('keeps the selected project visible when an earlier project response arrives later', async () => {
    let resolveProjectA!: (response: Response) => void
    const projectAResponse = new Promise<Response>((resolve) => {
      resolveProjectA = resolve
    })
    const projectBTask = { id: 2, title: 'Project B task', status: 'todo', priority: 'high' }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string) => {
        const url = new URL(input)
        if (url.pathname === '/projects') {
          return {
            ok: true,
            json: async () => [
              { id: 1, name: 'Project A', ownerId: 1 },
              { id: 2, name: 'Project B', ownerId: 1 },
            ],
          }
        }
        if (url.pathname.endsWith('/members')) return { ok: true, json: async () => [] }
        if (url.pathname === '/tasks' && url.searchParams.get('projectId') === '1') {
          return projectAResponse
        }
        if (url.pathname === '/tasks' && url.searchParams.get('projectId') === '2') {
          return { ok: true, json: async () => [projectBTask] }
        }
        throw new Error(`Unexpected request: ${input}`)
      }),
    )

    const wrapper = mount(TasksView, { global: { plugins: [createPinia()] } })
    await flushPromises()
    await wrapper.get('#project-select').setValue('2')
    await flushPromises()
    expect(wrapper.get('.task-list').text()).toContain('Project B task')

    resolveProjectA({
      ok: true,
      json: async () => [{ id: 1, title: 'Project A task', status: 'todo', priority: 'high' }],
    } as Response)
    await flushPromises()

    expect(wrapper.get('.task-list').text()).toContain('Project B task')
    expect(wrapper.get('.task-list').text()).not.toContain('Project A task')
    expect(wrapper.getComponent(TaskSummary).text()).toContain('Total Tasks: 1')
  })

  it('does not show partial project totals while a later page is loading or fails', async () => {
    let resolvePageTwo!: (response: Response) => void
    const pageTwo = new Promise<Response>((resolve) => {
      resolvePageTwo = resolve
    })
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      title: `Task ${index + 1}`,
      status: 'todo',
      priority: 'high',
    }))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string) => {
        const url = new URL(input)
        if (url.pathname === '/projects') {
          return { ok: true, json: async () => [{ id: 1, name: 'Project', ownerId: 1 }] }
        }
        if (url.pathname.endsWith('/members')) return { ok: true, json: async () => [] }
        if (url.pathname === '/tasks' && url.searchParams.get('page') === '1') {
          return { ok: true, json: async () => firstPage }
        }
        if (url.pathname === '/tasks' && url.searchParams.get('page') === '2') return pageTwo
        throw new Error(`Unexpected request: ${input}`)
      }),
    )

    const wrapper = mount(TasksView, { global: { plugins: [createPinia()] } })
    await flushPromises()
    expect(wrapper.text()).toContain('Loading tasks')
    expect(wrapper.findComponent(TaskSummary).exists()).toBe(false)

    resolvePageTwo({ ok: false } as Response)
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to load tasks')
    expect(wrapper.findComponent(TaskSummary).exists()).toBe(false)
  })
})
