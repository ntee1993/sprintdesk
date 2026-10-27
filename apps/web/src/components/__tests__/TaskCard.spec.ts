// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import TaskCard from '@/components/TaskCard.vue'

const task = {
  id: 10,
  title: 'Learn Unit Testing',
  status: 'todo' as const,
  priority: 'high' as const,
}

describe('TaskCard', () => {
  it('displays the task title', () => {
    const wrapper = mount(TaskCard, {
      props: {
        task,
      },
    })

    expect(wrapper.text()).toContain(task.title)
  })

  it('emits the task ID when Edit is clicked', async () => {
    const wrapper = mount(TaskCard, {
      props: {
        task,
      },
    })

    const buttons = wrapper.findAll('button')
    const editButton = buttons.find((button) => button.text() === 'Edit')

    if (!editButton) {
      throw new Error('Edit button not found')
    }

    await editButton.trigger('click')
    expect(wrapper.emitted('edit')).toEqual([[task.id]])
  })

  it('emits the task ID when Delete is clicked', async () => {
    const wrapper = mount(TaskCard, {
      props: {
        task,
      },
    })

    const buttons = wrapper.findAll('button')
    const deleteButton = buttons.find((button) => button.text() === 'Delete')

    if (!deleteButton) {
      throw new Error('Delete button not found')
    }

    await deleteButton.trigger('click')
    expect(wrapper.emitted('delete')).toEqual([[task.id]])
  })

  it('shows and hides details when expanded and collapsed', async () => {
    const wrapper = mount(TaskCard, { props: { task } })
    const button = wrapper.get('[aria-expanded]')

    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).not.toContain('Additional details are visible.')

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(wrapper.text()).toContain('Additional details are visible.')

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).not.toContain('Additional details are visible.')
  })
})
