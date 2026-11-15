// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.vue'

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    initialized: true,
    user: null,
    loading: false,
    error: null,
    initialize: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn(),
  }),
}))

afterEach(() => vi.unstubAllGlobals())

describe('registration navigation', () => {
  it('switches between sign in and registration and confirms success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201 }))
    const wrapper = mount(App, { attachTo: document.body })
    await wrapper.get('a').trigger('click')
    expect(wrapper.get('h1').text()).toBe('Create account.')
    expect(document.activeElement).toBe(wrapper.get('h1').element)
    await wrapper.get('a').trigger('click')
    expect(wrapper.get('h1').text()).toBe('Welcome back.')
    await wrapper.get('a').trigger('click')
    await wrapper.get('#register-name').setValue('Tester')
    await wrapper.get('#register-email').setValue('tester@example.test')
    await wrapper.get('#register-password').setValue('SecurePassword123!')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('Account created')
    expect(wrapper.get('h1').text()).toBe('Welcome back.')
    expect(document.activeElement).toBe(wrapper.get('h1').element)
    wrapper.unmount()
  })
})
