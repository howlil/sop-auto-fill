import { afterEach, describe, expect, it } from 'vitest'
import { removeKnownExtensionAttributes } from '../remove-known-extension-attributes'

describe('removeKnownExtensionAttributes', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.body.removeAttribute('bis_skin_checked')
  })

  it('removes known injected attributes from the root and its descendants', () => {
    const root = document.createElement('section')
    root.setAttribute('bis_skin_checked', '1')
    root.innerHTML = `
      <div bis_skin_checked="1" data-app-state="ready">
        <span bis_skin_checked="1">Content</span>
      </div>
    `

    expect(removeKnownExtensionAttributes(root)).toBe(3)
    expect(root.querySelectorAll('[bis_skin_checked]')).toHaveLength(0)
    expect(root.hasAttribute('bis_skin_checked')).toBe(false)
    expect(root.querySelector('[data-app-state="ready"]')).not.toBeNull()
  })

  it('removes a known injected attribute from the document before hydration', () => {
    document.body.setAttribute('bis_skin_checked', '1')

    expect(removeKnownExtensionAttributes()).toBe(1)
    expect(document.body.hasAttribute('bis_skin_checked')).toBe(false)
  })

  it('is idempotent after the injected attributes have been removed', () => {
    document.body.innerHTML = '<div bis_skin_checked="1"></div>'

    expect(removeKnownExtensionAttributes()).toBe(1)
    expect(removeKnownExtensionAttributes()).toBe(0)
  })
})
