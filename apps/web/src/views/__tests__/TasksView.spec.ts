// @vitest-environment jsdom
import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import TasksView from '../TasksView.vue'
import { useTaskStore } from '../../stores/task'

describe('TasksView', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, options?: RequestInit) =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (url.endsWith('/projects')) return [{ id: 1, name: 'Project', ownerId: 1 }]
            if (options?.method === 'POST') {
              return { id: 42, ...JSON.parse(options.body as string) }
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
})
