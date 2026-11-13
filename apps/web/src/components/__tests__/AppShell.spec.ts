// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import AppShell from '../AppShell.vue'

async function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/tasks', component: { template: '<div />' } },
      { path: '/projects', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(AppShell, {
    attachTo: document.body,
    global: { plugins: [router] },
    props: {
      user: { id: 1, name: 'Alex Morgan', email: 'alex@example.test' },
      loading: false,
      error: null,
    },
    slots: { default: '<p>Page content</p>' },
  })
  return { wrapper, router }
}

describe('AppShell', () => {
  it('shows the existing navigation and current user', async () => {
    const { wrapper } = await setup()
    expect(
      wrapper
        .get('nav')
        .findAll('a')
        .map((link) => link.attributes('href')),
    ).toEqual(['/', '/tasks', '/projects'])
    expect(wrapper.text()).toContain('Alex Morgan')
    expect(wrapper.text()).toContain('alex@example.test')
    expect(wrapper.get('a[href="/"]').attributes('aria-current')).toBe('page')
    expect(wrapper.text()).toContain('Page content')
    wrapper.unmount()
  })

  it('opens and closes mobile navigation with keyboard focus restored', async () => {
    const { wrapper } = await setup()
    const toggle = wrapper.get('button[aria-controls="app-sidebar"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(wrapper.get('nav a').element)
    await wrapper.get('.shell').trigger('keydown.esc')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle.element)
    wrapper.unmount()
  })

  it('keeps keyboard focus in the open navigation and makes content inert', async () => {
    const { wrapper } = await setup()
    await wrapper.get('button[aria-controls="app-sidebar"]').trigger('click')
    expect(wrapper.get('.shell-main').attributes('inert')).toBeDefined()
    const first = wrapper.get('nav a').element as HTMLElement
    const last = wrapper.get('button[aria-label="Log out"]').element as HTMLElement
    last.focus()
    await wrapper.get('.shell').trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    await wrapper.get('.shell').trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    await wrapper.get('.shell').trigger('keydown.esc')
    expect(wrapper.get('.shell-main').attributes('inert')).toBeUndefined()
    wrapper.unmount()
  })

  it('closes navigation when a navigation link is selected', async () => {
    const { wrapper } = await setup()
    await wrapper.get('button[aria-controls="app-sidebar"]').trigger('click')
    await wrapper.get('a[href="/tasks"]').trigger('click')
    expect(wrapper.get('button[aria-controls="app-sidebar"]').attributes('aria-expanded')).toBe(
      'false',
    )
    wrapper.unmount()
  })

  it('updates the page context and closes navigation after a route change', async () => {
    const { wrapper, router } = await setup()
    await wrapper.get('button[aria-controls="app-sidebar"]').trigger('click')
    await router.push('/tasks')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.breadcrumb').text()).toContain('Tasks')
    expect(wrapper.get('button[aria-controls="app-sidebar"]').attributes('aria-expanded')).toBe(
      'false',
    )
    wrapper.unmount()
  })

  it('emits logout and surfaces authentication errors', async () => {
    const { wrapper } = await setup()
    await wrapper.setProps({ error: 'Logout failed' })
    expect(wrapper.get('[role="alert"]').text()).toBe('Logout failed')
    await wrapper.get('button[aria-label="Log out"]').trigger('click')
    expect(wrapper.emitted('logout')).toHaveLength(1)
    await wrapper.setProps({ loading: true })
    expect(wrapper.get('button[aria-label="Log out"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
