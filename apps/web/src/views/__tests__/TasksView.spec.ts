// @vitest-environment jsdom
import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import TasksView from '@/views/TasksView.vue'
import { useTaskStore } from '@/stores/task'

describe('TasksView', () => {
  it('rejects a task with an empty title', async () => {
    const pinia = createPinia()
    const wrapper = mount(TasksView, {
      global: {
        plugins: [pinia],
      },
    })
    const taskStore = useTaskStore(pinia)
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
    const initialCount = taskStore.tasks.length

    await wrapper.get('#task-title').setValue('  Write Unit Tests  ')
    await wrapper.get('#task-status').setValue('in_progress')
    await wrapper.get('#task-priority').setValue('urgent')
    await wrapper.get('form').trigger('submit')

    expect(taskStore.tasks.length).toBe(initialCount + 1)

    expect(taskStore.tasks.at(-1)).toMatchObject({
      title: 'Write Unit Tests',
      status: 'in_progress',
      priority: 'urgent',
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
    const initialCount = taskStore.tasks.length

    await wrapper.get('#task-title').setValue('   ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('#task-title-error').text()).toBe('Task title is required.')

    await wrapper.get('#task-title').setValue('Fix Validation')
    expect(wrapper.find('#task-title-error').exists()).toBe(false)

    await wrapper.get('form').trigger('submit')
    expect(taskStore.tasks.length).toBe(initialCount + 1)
    expect(taskStore.tasks.at(-1)?.title).toBe('Fix Validation')
  })
})
