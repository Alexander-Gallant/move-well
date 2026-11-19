// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { starterExercises, starterRoutineGroups } from '../data'
import type { FitnessStorageState, RoutineSelection, SavedRoutine } from '../types'
import type { StorageAdapter } from '../storage'
import RoutineManager from './RoutineManager'

afterEach(() => cleanup())

const createSelections = (): RoutineSelection[] => starterRoutineGroups.map((group) => ({
  ...group,
  exercises: starterExercises.slice(0, 1).map((exercise) => ({
    ...exercise,
    muscles: [...exercise.muscles],
    instructions: [...exercise.instructions],
  })),
}))

const createRoutine = (id: string, name: string): SavedRoutine => ({
  id,
  name,
  selections: createSelections(),
})

const createHarness = (routines: SavedRoutine[], schedule: FitnessStorageState['schedule'] = []) => {
  let state: FitnessStorageState = {
    exercises: [],
    routines,
    schedule,
    reminders: { enabled: false, time: '09:00', notificationCapability: 'unsupported' },
  }
  const adapter: StorageAdapter = {
    read: () => state,
    write: (nextState) => {
      state = nextState
      return true
    },
  }

  return {
    adapter,
    getState: () => state,
  }
}

const renderManager = (routines = [createRoutine('routine-one', 'Wednesday reset')]) => {
  const harness = createHarness(routines)
  render(
    <RoutineManager
      createRoutineId={() => 'routine-new'}
      currentRoutine={createSelections()}
      storageAdapter={harness.adapter}
    />,
  )
  return harness
}

describe('RoutineManager', () => {
  it('saves the current generated routine with a trimmed name', async () => {
    const user = userEvent.setup()
    const harness = renderManager()

    await user.type(screen.getByLabelText(/save the current routine/i), '  Travel day  ')
    await user.click(screen.getByRole('button', { name: 'Save routine' }))

    expect(screen.getAllByText('Travel day').length).toBeGreaterThan(0)
    expect(harness.getState().routines.map((routine) => routine.name)).toContain('Travel day')
    expect(harness.getState().routines.find((routine) => routine.name === 'Travel day')?.id).toBe('routine-new')
  })

  it('validates a routine name before saving', async () => {
    const user = userEvent.setup()
    const harness = renderManager()

    await user.click(screen.getByRole('button', { name: 'Save routine' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name for this routine.')
    expect(harness.getState().routines).toHaveLength(1)
  })

  it('selects a saved routine and reflects it as the active routine', async () => {
    const user = userEvent.setup()
    const onRoutineSelect = vi.fn()
    const routines = [createRoutine('routine-one', 'Wednesday reset'), createRoutine('routine-two', 'Travel day')]
    const harness = createHarness(routines)
    render(
      <RoutineManager
        currentRoutine={createSelections()}
        onRoutineSelect={onRoutineSelect}
        storageAdapter={harness.adapter}
      />,
    )

    const travelRoutine = screen.getByRole('listitem', { name: /Travel day/ })
    await user.click(within(travelRoutine).getByRole('button', { name: 'Select Travel day' }))

    expect(screen.getByRole('heading', { name: 'Travel day' })).toBeInTheDocument()
    expect(within(travelRoutine).getByText('Selected')).toBeInTheDocument()
    expect(onRoutineSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'routine-two', name: 'Travel day' }))
  })

  it('validates and then saves a renamed routine without changing its ID', async () => {
    const user = userEvent.setup()
    const harness = renderManager()

    await user.click(screen.getByRole('button', { name: /Rename Wednesday reset/i }))
    const renameInput = screen.getByRole('textbox', { name: /Rename Wednesday reset/i })
    await user.clear(renameInput)
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name for this routine.')

    await user.type(renameInput, 'Evening recovery')
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    expect(screen.getAllByText('Evening recovery').length).toBeGreaterThan(0)
    expect(harness.getState().routines[0]).toMatchObject({ id: 'routine-one', name: 'Evening recovery' })
  })

  it('requires explicit confirmation before deleting a routine', async () => {
    const user = userEvent.setup()
    const routines = [createRoutine('routine-one', 'Wednesday reset'), createRoutine('routine-two', 'Travel day')]
    const harness = renderManager(routines)

    const travelRoutine = screen.getByRole('listitem', { name: /Travel day/ })
    await user.click(within(travelRoutine).getByRole('button', { name: /Delete Travel day/i }))
    expect(screen.getByRole('group', { name: 'Delete Travel day' })).toHaveTextContent('Delete this routine?')
    expect(harness.getState().routines).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    expect(screen.queryByText('Travel day')).not.toBeInTheDocument()
    expect(harness.getState().routines.map((routine) => routine.id)).toEqual(['routine-one'])
  })

  it('cascade-removes schedule assignments when deleting a routine', async () => {
    const user = userEvent.setup()
    const routines = [createRoutine('routine-one', 'Wednesday reset'), createRoutine('routine-two', 'Travel day')]
    const schedule: FitnessStorageState['schedule'] = [
      { id: 'kept-assignment', day: 'monday', time: '08:00', routineId: 'routine-one' },
      { id: 'deleted-assignment', day: 'friday', time: '18:00', routineId: 'routine-two' },
    ]
    const harness = createHarness(routines, schedule)
    render(
      <RoutineManager
        currentRoutine={createSelections()}
        storageAdapter={harness.adapter}
      />,
    )

    const travelRoutine = screen.getByRole('listitem', { name: /Travel day/ })
    await user.click(within(travelRoutine).getByRole('button', { name: /Delete Travel day/i }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    expect(harness.getState().schedule).toEqual([schedule[0]])
  })

  it('prevents deleting the final routine and explains why', async () => {
    const user = userEvent.setup()
    const harness = renderManager()

    await user.click(screen.getByRole('button', { name: /Delete Wednesday reset/i }))

    expect(screen.getByRole('alert')).toHaveTextContent('Keep at least one routine.')
    expect(screen.getByText(/At least one routine is always kept/)).toBeInTheDocument()
    expect(harness.getState().routines).toHaveLength(1)
  })
})
