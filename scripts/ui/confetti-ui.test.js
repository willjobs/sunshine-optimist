// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { launchConfetti } from './confetti-ui.js'

describe('confetti-ui', () => {
  it('creates confetti pieces and clears them after the timeout', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const root = document.createElement('div')
    launchConfetti(root)
    expect(root.querySelectorAll('.confetti-piece')).toHaveLength(72)

    vi.advanceTimersByTime(4000)
    expect(root.querySelectorAll('.confetti-piece')).toHaveLength(0)

    Math.random.mockRestore()
    vi.useRealTimers()
  })
})
