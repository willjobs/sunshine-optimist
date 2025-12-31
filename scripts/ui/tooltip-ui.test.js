// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { updateDeltaTooltip, closeDeltaTooltips } from './tooltip-ui.js'

describe('tooltip-ui', () => {
  it('adds and removes tooltip attributes', () => {
    const target = document.createElement('span')
    target.textContent = 'earliest sunset'

    updateDeltaTooltip(target, '5:00 PM on Dec 1')
    expect(target.dataset.tooltip).toBe('5:00 PM on Dec 1')
    expect(target.getAttribute('role')).toBe('button')
    expect(target.getAttribute('tabindex')).toBe('0')
    expect(target.getAttribute('aria-expanded')).toBe('false')

    updateDeltaTooltip(target, '')
    expect(target.dataset.tooltip).toBeUndefined()
    expect(target.getAttribute('role')).toBe(null)
    expect(target.getAttribute('tabindex')).toBe(null)
    expect(target.getAttribute('aria-expanded')).toBe(null)
  })

  it('closes other tooltips when requested', () => {
    const first = document.createElement('span')
    const second = document.createElement('span')
    first.classList.add('is-tooltip-open')
    second.classList.add('is-tooltip-open')
    first.setAttribute('aria-expanded', 'true')
    second.setAttribute('aria-expanded', 'true')

    closeDeltaTooltips([first, second], second)
    expect(first.classList.contains('is-tooltip-open')).toBe(false)
    expect(first.getAttribute('aria-expanded')).toBe('false')
    expect(second.classList.contains('is-tooltip-open')).toBe(true)
  })
})
