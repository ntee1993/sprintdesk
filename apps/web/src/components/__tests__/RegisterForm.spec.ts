// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RegisterForm from '../RegisterForm.vue'

async function fill(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('#register-name').setValue('Tester')
  await wrapper.get('#register-email').setValue('tester@example.test')
  await wrapper.get('#register-password').setValue('SecurePassword123!')
}

afterEach(() => vi.unstubAllGlobals())

describe('registration', () => {
  it('sends the registration contract and returns to sign in on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(RegisterForm)
    await fill(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/\/auth\/register$/),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          name: 'Tester',
          email: 'tester@example.test',
          password: 'SecurePassword123!',
        }),
      }),
    )
    expect(wrapper.emitted('registered')).toHaveLength(1)
    expect((wrapper.get('#register-password').element as HTMLInputElement).value).toBe('')
  })

  it.each([
    [400, 'Check your name, email and password'],
    [409, 'This email is already registered.'],
    [429, 'Too many attempts.'],
  ])('shows a helpful error for HTTP %i', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }))
    const wrapper = mount(RegisterForm)
    await fill(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain(message)
    expect(wrapper.emitted('registered')).toBeUndefined()
  })

  it('shows network errors without clearing the draft', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const wrapper = mount(RegisterForm)
    await fill(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Network error')
    expect((wrapper.get('#register-email').element as HTMLInputElement).value).toBe('tester@example.test')
  })

  it('prevents duplicate submissions while pending', async () => {
    let resolve!: (value: { ok: boolean; status: number }) => void
    const fetchMock = vi.fn().mockReturnValue(new Promise((done) => { resolve = done }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(RegisterForm)
    await fill(wrapper)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(fetchMock).toHaveBeenCalledOnce()
    resolve({ ok: true, status: 201 })
    await flushPromises()
  })

  it('provides a back to sign in action and focuses the heading', async () => {
    const wrapper = mount(RegisterForm, { attachTo: document.body })
    expect(document.activeElement).toBe(wrapper.get('h1').element)
    await wrapper.get('a').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
    wrapper.unmount()
  })
})
