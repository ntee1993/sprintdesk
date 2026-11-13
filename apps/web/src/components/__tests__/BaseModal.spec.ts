// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import BaseModal from '../BaseModal.vue'

describe('BaseModal', () => {
  it('restores focus to the opener when unmounted', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '')
      }),
    })
    const wrapper = mount(BaseModal, { attachTo: document.body, props: { title: 'Task Details' } })
    wrapper.get('button').element.focus()
    expect(document.activeElement).toBe(wrapper.get('button').element)
    wrapper.unmount()
    expect(document.activeElement).toBe(opener)
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    opener.remove()
  })
})
