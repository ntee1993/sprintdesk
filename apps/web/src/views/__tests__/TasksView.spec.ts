// @vitest-environment jsdom
import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import TasksView from '../TasksView.vue'
import TaskCard from '../../components/TaskCard.vue'
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

    const taskPostCalls = vi.mocked(fetch).mock.calls.filter(
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
})
