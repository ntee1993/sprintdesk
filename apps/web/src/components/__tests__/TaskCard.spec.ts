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
  it('TaskCard contains task title', () => {
    const wrapper = mount(TaskCard, {
      props: {
        task,
      },
    })

    expect(wrapper.text()).toContain(task.title)
  })

  it('edit button sends the right event and task id', async () => {
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
    expect(wrapper.emitted('edit')).toEqual([[10]])
  })

  it('delete button sends the right event and task id', async () => {
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
    expect(wrapper.emitted('delete')).toEqual([[10]])
  })
})
