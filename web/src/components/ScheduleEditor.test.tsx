// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { starterExercises, starterRoutineGroups } from '../data'
import { createDefaultStorageState, createStorageAdapter, type StorageLike } from '../storage'
import type { RoutineSelection, SavedRoutine, WeeklyScheduleEntry } from '../types'
import ScheduleEditor from './ScheduleEditor'

afterEach(() => cleanup())

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

const createSelections = (): RoutineSelection[] => starterRoutineGroups.map((group) => ({
  ...group,
  exercises: starterExercises.slice(0, 1).map((exercise) => ({
    ...exercise,
    muscles: [...exercise.muscles],
    instructions: [...exercise.instructions],
  })),
}))

const createRoutine = (id: string, name: string): SavedRoutine => ({ id, name, selections: createSelections() })

const createHarness = (schedule: WeeklyScheduleEntry[] = []) => {
  const adapter = createStorageAdapter(new MemoryStorage())
  const state = createDefaultStorageState()
  adapter.write({ ...state, routines: [createRoutine('strength', 'Strength'), createRoutine('mobility', 'Mobility')], schedule })
  return adapter
}

const renderEditor = (schedule: WeeklyScheduleEntry[] = []) => {
  const adapter = createHarness(schedule)
  render(<ScheduleEditor createEntryId={() => 'new-assignment'} storageAdapter={adapter} />)
  return adapter
}

describe('ScheduleEditor', () => {
  it('adds an assignment for a weekday and persists it through the storage adapter', async () => {
    const user = userEvent.setup()
    const adapter = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Add assignment' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Weekday' }), 'wednesday')
    await user.clear(screen.getByLabelText('Time'))
    await user.type(screen.getByLabelText('Time'), '18:30')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Saved routine' }), 'strength')
    await user.click(screen.getByRole('button', { name: 'Save assignment' }))

    expect(adapter.read().schedule).toEqual([{ id: 'new-assignment', day: 'wednesday', time: '18:30', routineId: 'strength' }])
    expect(screen.getByText('Strength')).toBeInTheDocument()
    expect(screen.getByText('1 session')).toBeInTheDocument()
  })

  it('supports more than one assignment on the same day in time order', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Add assignment' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Weekday' }), 'monday')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Saved routine' }), 'strength')
    await user.click(screen.getByRole('button', { name: 'Save assignment' }))
    await user.click(screen.getByRole('button', { name: 'Add assignment for Monday' }))
    await user.clear(screen.getByLabelText('Time'))
    await user.type(screen.getByLabelText('Time'), '07:30')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Saved routine' }), 'mobility')
    await user.click(screen.getByRole('button', { name: 'Save assignment' }))

    const monday = screen.getByRole('article', { name: 'Monday schedule' })
    expect(screen.getByText('2 sessions')).toBeInTheDocument()
    expect(within(monday).getAllByRole('listitem')).toHaveLength(2)
    expect(within(monday).getAllByText(/^(07:30|09:00)$/).map((element) => element.textContent)).toEqual(['07:30', '09:00'])
  })

  it('edits an existing assignment without creating a second entry', async () => {
    const user = userEvent.setup()
    const adapter = renderEditor([{ id: 'existing', day: 'tuesday', time: '09:00', routineId: 'strength' }])

    await user.click(screen.getByRole('button', { name: 'Edit Tuesday assignment' }))
    await user.clear(screen.getByLabelText('Time'))
    await user.type(screen.getByLabelText('Time'), '20:15')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Saved routine' }), 'mobility')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(adapter.read().schedule).toEqual([{ id: 'existing', day: 'tuesday', time: '20:15', routineId: 'mobility' }])
    expect(screen.getByText('Mobility')).toBeInTheDocument()
  })

  it('removes an assignment and renders empty weekdays as rest days', async () => {
    const user = userEvent.setup()
    const adapter = renderEditor([{ id: 'existing', day: 'friday', time: '12:00', routineId: 'strength' }])

    expect(screen.getAllByText('Rest day')).toHaveLength(6)
    await user.click(screen.getByRole('button', { name: 'Remove Friday assignment' }))

    expect(adapter.read().schedule).toEqual([])
    expect(screen.getAllByText('Rest day')).toHaveLength(7)
  })

  it('rejects invalid time and missing routine without writing a partial assignment', async () => {
    const user = userEvent.setup()
    const adapter = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Add assignment' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Saved routine' }), '')
    const timeInput = screen.getByLabelText('Time')
    await user.clear(timeInput)
    await user.click(screen.getByRole('button', { name: 'Save assignment' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/valid time/i)
    expect(adapter.read().schedule).toEqual([])

    await user.type(timeInput, '08:00')
    await user.click(screen.getByRole('button', { name: 'Save assignment' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/choose a saved routine/i)
    expect(adapter.read().schedule).toEqual([])
  })
})
