// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as dateController from './date-controller.js'
import {
  getCustomDateParts,
  isUsingLiveDate,
  setCustomDateParts,
  setUseLiveDate,
  setActiveLocation,
  setLastKeydownAt,
} from '../state/app-state.js'

const buildDom = () => {
  const dateInput = document.createElement('input')
  dateInput.type = 'date'
  const dateReset = document.createElement('button')
  const datePicker = document.createElement('div')
  datePicker.className = 'date-picker'
  return { dateInput, dateReset, datePicker }
}

beforeEach(() => {
  setUseLiveDate(true)
  setCustomDateParts(null)
  setActiveLocation(null)
  dateController.setDateChangeCallback(null)
})

afterEach(() => {
  dateController.clearDateCommitTimeout()
  vi.useRealTimers()
})

describe('date-controller', () => {
  it('applies date selection changes', () => {
    expect(dateController.applyDateSelection(null)).toBe(false)
    expect(isUsingLiveDate()).toBe(true)

    const changed = dateController.applyDateSelection({ year: 2024, month: 6, day: 1 })
    expect(changed).toBe(true)
    expect(isUsingLiveDate()).toBe(false)
    expect(getCustomDateParts()).toEqual({ year: 2024, month: 6, day: 1 })

    const noChange = dateController.applyDateSelection({ year: 2024, month: 6, day: 1 })
    expect(noChange).toBe(false)
  })

  it('syncs date picker UI state', () => {
    const { dateInput, dateReset, datePicker } = buildDom()
    setUseLiveDate(false)
    setCustomDateParts({ year: 2024, month: 6, day: 2 })

    dateController.syncDatePicker(dateInput, dateReset, datePicker, 'UTC')
    expect(dateInput.value).toBe('2024-06-02')
    expect(dateReset.disabled).toBe(false)
    expect(datePicker.classList.contains('is-custom')).toBe(true)
  })

  it('commits a date selection and notifies the callback', () => {
    const { dateInput, dateReset, datePicker } = buildDom()
    dateInput.value = '2024-06-03'

    const location = { name: 'Test City', timezone: 'UTC' }
    setActiveLocation(location)

    const onChange = vi.fn()
    dateController.setDateChangeCallback(onChange)

    dateController.commitDateSelection(dateInput, dateReset, datePicker, 'UTC')
    expect(onChange).toHaveBeenCalledWith(location)

    dateController.commitDateSelection(dateInput, dateReset, datePicker, 'UTC')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('debounces date commits and respects keyboard grace period', () => {
    const { dateInput, dateReset, datePicker } = buildDom()
    dateInput.value = '2024-06-04'

    vi.useFakeTimers()
    dateController.scheduleDateCommit(dateInput, dateReset, datePicker, 'UTC')
    vi.advanceTimersByTime(300)
    expect(isUsingLiveDate()).toBe(false)

    const now = Date.now()
    setLastKeydownAt(now - 100)
    expect(dateController.isRecentDateKeyboardInput()).toBe(true)
    setLastKeydownAt(now - 2000)
    expect(dateController.isRecentDateKeyboardInput()).toBe(false)
  })
})
