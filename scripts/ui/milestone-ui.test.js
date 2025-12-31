// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  getMilestoneKey,
  getMilestoneTodayCopy,
  updateMilestoneCard,
} from './milestone-ui.js'

const buildDom = () => {
  const nextHeadline = document.createElement('p')
  const nextDate = document.createElement('span')
  const nextAway = document.createElement('span')
  const milestone = document.createElement('div')
  const milestoneToggle = document.createElement('button')
  return { nextHeadline, nextDate, nextAway, milestone, milestoneToggle }
}

describe('milestone-ui', () => {
  it('builds milestone keys and fallback copy', () => {
    const milestone = {
      id: 'test',
      title: 'Test milestone',
      dateParts: { year: 2024, month: 6, day: 1 },
    }
    expect(getMilestoneKey(milestone)).toBe('test:2024-06-01')
    expect(getMilestoneTodayCopy(milestone)).toEqual({
      headline: 'Test milestone is today.',
      lede: 'Enjoy the moment!',
    })
  })

  it('renders empty milestone state', () => {
    const dom = buildDom()
    updateMilestoneCard(dom, [], 'UTC', () => 'date')

    expect(dom.nextHeadline.textContent).toBe('No upcoming milestones')
    expect(dom.nextDate.textContent).toBe('—')
    expect(dom.nextAway.textContent).toBe('')
    expect(dom.milestoneToggle.disabled).toBe(true)
    expect(dom.milestoneToggle.getAttribute('aria-label')).toBe('Next milestone')
  })

  it('renders milestone list and updates aria labels', () => {
    const dom = buildDom()
    const milestones = [
      { title: 'First', dateParts: { year: 2024, month: 6, day: 2 }, offsetDays: 1 },
      { title: 'Second', dateParts: { year: 2024, month: 6, day: 3 }, offsetDays: 2 },
    ]
    const formatDate = (parts) => `date-${parts.day}`

    updateMilestoneCard(dom, milestones, 'UTC', formatDate)

    expect(dom.nextHeadline.textContent).toBe('First')
    expect(dom.nextDate.textContent).toBe('date-2')
    expect(dom.milestoneToggle.disabled).toBe(false)
    expect(dom.milestoneToggle.getAttribute('aria-label')).toBe('Next milestone (1 of 2)')
    expect(dom.milestone.getAttribute('aria-label')).toBe('Upcoming milestone: First')
  })
})
