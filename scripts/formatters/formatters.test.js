import { describe, it, expect } from 'vitest'
import {
  formatDuration,
  formatMinutesValue,
  formatShareMinutes,
  formatDaysValue,
  formatWeeksValue,
  formatShareDayCount,
  formatMilestoneAway,
  formatDeltaStatement,
  formatSharePercent,
  buildShareBar,
  formatPlaceholderValue,
  lowerCaseFirstLetter,
  formatOptimisticLogHeadline,
  buildOptimisticLogLine,
} from './formatters.js'

describe('formatters', () => {
  it('formats durations and minutes', () => {
    expect(formatDuration(45)).toBe('45m')
    expect(formatDuration(75)).toBe('1h 15m')
    expect(formatMinutesValue(1)).toBe('1 minute')
    expect(formatMinutesValue(90)).toBe('1 hr 30 mins')
    expect(formatShareMinutes(1)).toBe('1 min')
    expect(formatShareMinutes(0)).toBe('0 mins')
  })

  it('formats days, weeks, and milestone offsets', () => {
    expect(formatDaysValue(7)).toBe('7 days')
    expect(formatDaysValue(15)).toBe('less than 3 weeks')
    expect(formatWeeksValue(2)).toBe('2 weeks')
    expect(formatShareDayCount(3)).toBe('3 days')
    expect(formatShareDayCount(0)).toBe('')
    expect(formatMilestoneAway(10)).toBe('(10 days away)')
    expect(formatMilestoneAway(15)).toBe('(< 3 weeks away)')
  })

  it('formats delta statements and percentages', () => {
    expect(formatDeltaStatement(65, 'later', 'earlier')).toBe('1h 5m later')
    expect(formatDeltaStatement(-1, 'later', 'earlier')).toBe('1 minute earlier')
    expect(formatDeltaStatement(0, 'later', 'earlier')).toBe('0 minutes later')
    expect(formatSharePercent(1.2)).toBe('100%')
  })

  it('builds share bars with clamped length', () => {
    const filled = String.fromCharCode(9608)
    const empty = String.fromCharCode(9617)
    expect(buildShareBar(0.5, 4)).toBe(`${filled}${filled}${empty}${empty}`)
  })

  it('formats placeholder values and log lines', () => {
    expect(formatPlaceholderValue('minutes', 2)).toBe('2 minutes')
    expect(formatPlaceholderValue('%', 50)).toBe('50%')
    expect(lowerCaseFirstLetter('Hello')).toBe('hello')
    expect(formatOptimisticLogHeadline('Hello world')).toBe('Hello world.')
    expect(buildOptimisticLogLine({ headline: 'Hello', lede: 'There' })).toBe('- Hello. There')
  })
})
