// @vitest-environment jsdom
import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectsView from '../ProjectsView.vue'
import { useAuthStore } from '../../stores/auth'
import { addProjectMember, getProjectMembers, getProjects } from '../../services/projects-api'

vi.mock('../../services/projects-api', () => ({
  getProjects: vi.fn(),
  createProject: vi.fn(),
  getProjectMembers: vi.fn(),
  addProjectMember: vi.fn(),
}))

describe('ProjectsView members', () => {
  const project = { id: 1, name: 'SprintDesk', ownerId: 1 }
  const owner = { userId: 1, name: 'Alice', email: 'alice@example.test', role: 'OWNER' } as const
  const editor = { userId: 2, name: 'Bob', email: 'bob@example.test', role: 'EDITOR' } as const

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getProjects).mockResolvedValue([project])
    vi.mocked(getProjectMembers).mockResolvedValue([owner])
  })

  async function mountProjectsView(userId: number) {
    const pinia = createPinia()
    useAuthStore(pinia).user = { id: userId, name: 'User', email: 'user@example.test' }
    const wrapper = mount(ProjectsView, { global: { plugins: [pinia] } })
    await flushPromises()
    await wrapper.get('#members-project').setValue('1')
    await flushPromises()
    return wrapper
  }

  it('loads and displays members when a project is selected', async () => {
    vi.mocked(getProjectMembers).mockResolvedValue([owner, editor])

    const wrapper = await mountProjectsView(1)

    expect(getProjectMembers).toHaveBeenCalledExactlyOnceWith(1)
    expect(wrapper.text()).toContain('Alice — alice@example.test — OWNER')
    expect(wrapper.text()).toContain('Bob — bob@example.test — EDITOR')
  })

  it('reloads members after an owner adds a member', async () => {
    vi.mocked(getProjectMembers)
      .mockResolvedValueOnce([owner])
      .mockResolvedValueOnce([owner, editor])
    vi.mocked(addProjectMember).mockResolvedValue()
    const wrapper = await mountProjectsView(1)

    await wrapper.get('#member-email').setValue('bob@example.test')
    await wrapper.get('#member-role').setValue('EDITOR')
    await wrapper.get('section form').trigger('submit')
    await flushPromises()

    expect(addProjectMember).toHaveBeenCalledExactlyOnceWith(1, 'bob@example.test', 'EDITOR')
    expect(getProjectMembers).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Bob — bob@example.test — EDITOR')
  })

  it('does not show the add-member form to a non-owner', async () => {
    const wrapper = await mountProjectsView(2)

    expect(wrapper.find('#member-email').exists()).toBe(false)
    expect(wrapper.find('section form').exists()).toBe(false)
  })
})
