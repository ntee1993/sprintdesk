// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskDetailsModal from '../TaskDetailsModal.vue'
import { useAuthStore } from '@/stores/auth'
import { logout } from '@/services/auth-api'
import {
  getTaskComments,
  createTaskComment,
  updateTaskComment,
  deleteTaskComment,
  type TaskComment,
} from '@/services/task-comments-api'

vi.mock('@/services/task-comments-api', () => ({
  getTaskComments: vi.fn(),
  createTaskComment: vi.fn(),
  updateTaskComment: vi.fn(),
  deleteTaskComment: vi.fn(),
}))
vi.mock('@/services/auth-api', () => ({ getCurrentUser: vi.fn(), login: vi.fn(), logout: vi.fn() }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const task = { id: 1, title: 'Task', status: 'todo' as const, priority: 'high' as const }
const comment: TaskComment = {
  id: 1,
  taskId: 1,
  authorId: 7,
  content: 'Original',
  createdAt: '2026-11-13T09:00:00Z',
  updatedAt: '2026-11-13T09:00:00Z',
  author: { id: 7, name: 'Bob' },
}
function setup(userId = 7) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = { id: userId, name: 'Tester', email: 'test@example.test' }
  const wrapper = mount(TaskDetailsModal, {
    props: { task },
    global: { plugins: [pinia], stubs: { BaseModal: { template: '<div><slot /></div>' } } },
  })
  return { wrapper, auth }
}

describe('Task details comments', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getTaskComments).mockResolvedValue([])
  })

  it('loads comments for the selected task and displays them in creation order', async () => {
    vi.mocked(getTaskComments).mockResolvedValue([
      { ...comment, id: 2, content: 'Later', createdAt: '2026-11-14T09:00:00Z' },
      comment,
    ])
    const { wrapper } = setup()
    await flushPromises()
    expect(getTaskComments).toHaveBeenCalledExactlyOnceWith(1)
    expect(wrapper.findAll('li').map((row) => row.text())).toEqual([
      expect.stringContaining('Original'),
      expect.stringContaining('Later'),
    ])
    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.get('time').attributes('datetime')).toBe(comment.createdAt)
  })

  it('allows a viewer to create a comment', async () => {
    vi.mocked(createTaskComment).mockResolvedValue(comment)
    const { wrapper } = setup()
    await flushPromises()
    await wrapper.get('#new-comment').setValue('Original')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(createTaskComment).toHaveBeenCalledExactlyOnceWith(1, 'Original')
    expect(wrapper.text()).toContain('Original')
  })

  it('updates and deletes an author comment after API success', async () => {
    vi.mocked(getTaskComments).mockResolvedValue([comment])
    vi.mocked(updateTaskComment).mockResolvedValue({ ...comment, content: 'Edited' })
    vi.mocked(deleteTaskComment).mockResolvedValue()
    const { wrapper } = setup()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Edit comment')!
      .trigger('click')
    await wrapper.get('#edit-comment-1').setValue('Edited')
    await wrapper.findAll('form')[0]!.trigger('submit')
    await flushPromises()
    expect(updateTaskComment).toHaveBeenCalledExactlyOnceWith(1, 1, 'Edited')
    expect(wrapper.text()).toContain('Edited')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Delete comment')!
      .trigger('click')
    await flushPromises()
    expect(deleteTaskComment).toHaveBeenCalledExactlyOnceWith(1, 1)
    expect(wrapper.text()).not.toContain('Edited')
  })

  it('hides edit and delete from non-authors', async () => {
    vi.mocked(getTaskComments).mockResolvedValue([comment])
    const { wrapper } = setup(8)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Edit comment')
    expect(wrapper.text()).not.toContain('Delete comment')
    expect(wrapper.text()).toContain('Original')
  })

  it('ignores an old task response after changing tasks', async () => {
    const pending = deferred<TaskComment[]>()
    vi.mocked(getTaskComments)
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce([{ ...comment, id: 2, taskId: 2, content: 'New task' }])
    const { wrapper } = setup()
    await wrapper.setProps({ task: { ...task, id: 2 } })
    await flushPromises()
    pending.resolve([comment])
    await flushPromises()
    expect(wrapper.text()).toContain('New task')
    expect(wrapper.text()).not.toContain('Original')
  })

  it('ignores a comment creation completed after logout', async () => {
    const pending = deferred<TaskComment>()
    vi.mocked(createTaskComment).mockReturnValue(pending.promise)
    vi.mocked(logout).mockResolvedValue()
    const { wrapper, auth } = setup()
    await flushPromises()
    await wrapper.get('#new-comment').setValue('Original')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await auth.signOut()
    pending.resolve(comment)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Original')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('ignores a pending update after changing tasks', async () => {
    const pending = deferred<TaskComment>()
    const newComment = { ...comment, taskId: 2, content: 'New task comment' }
    vi.mocked(getTaskComments).mockResolvedValueOnce([comment]).mockResolvedValueOnce([newComment])
    vi.mocked(updateTaskComment).mockReturnValue(pending.promise)
    const { wrapper } = setup()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Edit comment')!
      .trigger('click')
    await wrapper.get('#edit-comment-1').setValue('Old task update')
    await wrapper.findAll('form')[0]!.trigger('submit')
    expect(updateTaskComment).toHaveBeenCalledExactlyOnceWith(1, 1, 'Old task update')
    await wrapper.setProps({ task: { ...task, id: 2 } })
    await flushPromises()
    pending.resolve({ ...comment, content: 'Old task update' })
    await flushPromises()
    expect(wrapper.text()).toContain('New task comment')
    expect(wrapper.text()).not.toContain('Old task update')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('ignores a pending delete failure after the session changes', async () => {
    const pending = deferred<void>()
    vi.mocked(getTaskComments).mockResolvedValue([comment])
    vi.mocked(deleteTaskComment).mockReturnValue(pending.promise)
    vi.mocked(logout).mockResolvedValue()
    const { wrapper, auth } = setup()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Delete comment')!
      .trigger('click')
    expect(deleteTaskComment).toHaveBeenCalledExactlyOnceWith(1, 1)
    await auth.signOut()
    pending.reject(new Error('Old session delete failed'))
    await flushPromises()
    expect(wrapper.text()).not.toContain('Original')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('shows API errors without losing existing comments', async () => {
    vi.mocked(getTaskComments).mockResolvedValue([comment])
    vi.mocked(deleteTaskComment).mockRejectedValue(new Error('Delete failed'))
    const { wrapper } = setup()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Delete comment')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Delete failed')
    expect(wrapper.text()).toContain('Original')
  })
})
