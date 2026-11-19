// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createDefaultStorageState, LEGACY_EXERCISES_KEY, LEGACY_ROUTINE_KEY, STORAGE_KEY, writeStorage } from './storage'
import { starterExercises, starterRoutineGroups } from './data'

const legacyExercise = {
  id: 'legacy-mobility',
  name: 'Legacy mobility flow',
  type: 'Stretch' as const,
  muscles: ['Hips'],
  category: 'Mobility',
  description: 'A migrated exercise kept from the previous app version.',
  instructions: ['Move slowly through a comfortable range.'],
  duration: '4 min',
}

const legacySelection = {
  ...starterRoutineGroups[0],
  exercises: [legacyExercise],
}

const seedLegacyState = () => {
  localStorage.setItem(LEGACY_EXERCISES_KEY, JSON.stringify([...starterExercises, legacyExercise]))
  localStorage.setItem(LEGACY_ROUTINE_KEY, JSON.stringify([legacySelection]))
}

const seedExerciseLibrary = () => {
  const state = createDefaultStorageState()
  state.exercises = starterExercises.map((exercise) => ({
    ...exercise,
    muscles: [...exercise.muscles],
    specificMuscles: [...exercise.specificMuscles],
    instructions: [...exercise.instructions],
    steps: [...exercise.steps],
    commonErrors: exercise.commonErrors.map((pair) => ({ ...pair })),
    tags: [...exercise.tags],
  }))
  state.routines = [{
    ...state.routines[0]!,
    selections: starterRoutineGroups.map((group) => ({
      ...group,
      exercises: state.exercises
        .filter((exercise) => exercise.type === group.type
          && (group.muscle === 'All' || exercise.muscles.includes(group.muscle)))
        .slice(0, group.count),
    })),
  }]
  writeStorage(state, localStorage)
}

const navigateTo = async (user: ReturnType<typeof userEvent.setup>, view: string) => {
  await user.click(screen.getByRole('button', { name: view }))
  expect(screen.getByRole('heading', { level: 1, name: view })).toBeInTheDocument()
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('Notification', undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('integrated fitness app', () => {
  // Objective: preserve migrated data while a user completes the main Phase 2 journey.
  it('migrates legacy state, manages a routine, assigns it, configures reminders, and persists after reload', async () => {
    // Arrange
    seedLegacyState()
    const user = userEvent.setup()
    const firstRender = render(<App />)

    // Assert: legacy exercises and snapshots are purged while routine structure remains.
    const migratedState = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').data
    expect(migratedState.exercises).toEqual([])
    expect(migratedState.routines[0].selections[0].exercises).toEqual([])

    // Act: migrate legacy state and save a second routine from the generated builder.
    await navigateTo(user, 'Routine Builder')
    await user.click(screen.getByRole('button', { name: /Save or manage routine/i }))
    const routineNameInput = screen.getByLabelText(/Save the current routine/i)
    await user.clear(routineNameInput)
    await user.type(routineNameInput, ' Travel day ')
    await user.click(screen.getByRole('button', { name: 'Save routine' }))

    // Assert: the saved routine is trimmed, selected, and represented in persisted state.
    expect(screen.getByRole('status')).toHaveTextContent('Travel day was saved.')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      data: { routines: expect.arrayContaining([expect.objectContaining({ name: 'Travel day' })]) },
    })

    // Act: choose the migrated routine, then assign the new routine to Wednesday.
    await user.click(screen.getByRole('button', { name: 'Select Wednesday reset' }))
    await navigateTo(user, 'Dashboard')
    expect(screen.getByRole('heading', { level: 2, name: 'Wednesday reset' })).toBeInTheDocument()
    await navigateTo(user, 'Schedule')
    await user.click(screen.getByRole('button', { name: 'Add assignment' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Weekday' }), 'wednesday')
    await user.clear(screen.getByLabelText('Time'))
    await user.type(screen.getByLabelText('Time'), '18:30')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Saved routine' }),
      screen.getByRole('option', { name: 'Travel day' }),
    )
    await user.click(screen.getByRole('button', { name: 'Save assignment' }))

    // Assert: the weekly assignment is shown with the selected routine.
    const wednesday = screen.getByRole('article', { name: 'Wednesday schedule' })
    expect(within(wednesday).getByText('18:30')).toBeInTheDocument()
    expect(within(wednesday).getByText('Travel day')).toBeInTheDocument()

    // Act: enable reminders without a Notification API or a permission prompt.
    await navigateTo(user, 'Reminders')
    await user.click(screen.getByRole('checkbox', { name: /Enable workout reminders/i }))
    fireEvent.change(screen.getByLabelText('Reminder time'), { target: { value: '07:30' } })

    // Assert: unsupported browsers retain visible, persisted reminders and offer no prompt action.
    expect(screen.getByRole('status')).toHaveTextContent('Reminders remain visible in your schedule')
    expect(screen.queryByRole('button', { name: /enable browser notifications/i })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      data: { reminders: { enabled: true, time: '07:30', notificationCapability: 'unsupported' } },
    })

    // Act: simulate a browser reload by remounting the integrated application.
    firstRender.unmount()
    render(<App />)

    // Assert: persisted schedule and reminder settings survive reload while the purge remains applied.
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    await navigateTo(user, 'Schedule')
    expect(screen.getByRole('article', { name: 'Wednesday schedule' })).toHaveTextContent('Travel day')
    await navigateTo(user, 'Reminders')
    expect(screen.getByRole('checkbox', { name: /Enable workout reminders/i })).toBeChecked()
    expect(screen.getByLabelText('Reminder time')).toHaveValue('07:30')
    await navigateTo(user, 'Exercise Library')
    expect(screen.getByText('No exercises match these filters.')).toBeInTheDocument()
  })

  // Objective: keep custom exercise input validated and the library usable through user actions.
  it('rejects an incomplete custom exercise and persists a valid custom exercise', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<App />)
    await navigateTo(user, 'Exercise Library')
    await user.click(screen.getByRole('button', { name: /Add exercise/i }))

    // Act: submit the empty form.
    await user.click(screen.getByRole('button', { name: /Save exercise/ }))

    // Assert: validation explains the failure and does not add an exercise.
    expect(screen.getByText('Add an exercise name.')).toBeInTheDocument()
    expect(screen.queryByText('Mobility hinge')).not.toBeInTheDocument()

    // Act: provide a complete, deterministic exercise draft and submit it.
    await user.type(screen.getByLabelText('Exercise name'), 'Mobility hinge')
    await user.type(screen.getByLabelText('Group'), 'Mobility')
    await user.type(screen.getByLabelText(/Targeted musclegroups/i), 'Hips, Hamstrings')
    await user.type(screen.getByLabelText(/Step-by-step movement/i), 'Stand tall\nHinge gently')
    vi.spyOn(Date, 'now').mockReturnValue(1_729_512_000_000)
    await user.click(screen.getByRole('button', { name: /Save exercise/ }))

    // Assert: the exercise is visible, persisted, and its details remain accessible.
    expect(screen.getByText('Mobility hinge')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      data: {
        exercises: expect.arrayContaining([expect.objectContaining({
          name: 'Mobility hinge',
          group: 'Mobility',
          muscles: ['Hips', 'Hamstrings'],
          steps: ['Stand tall', 'Hinge gently'],
          commonErrors: [],
          tags: [],
          isFavorite: false,
        })]),
      },
    })
    await user.click(screen.getByRole('button', { name: 'Mobility hinge' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Stand tall')
  })

  it('loads the complete imported catalogue into a fresh library', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<App />)

    // Act
    await navigateTo(user, 'Exercise Library')

    // Assert
    expect(screen.getByRole('button', { name: 'Supine thoracic extension over a rolled towel or foam roller' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Comfortable walking' })).toHaveLength(2)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').data.exercises).toHaveLength(73)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').data.exercises).toEqual(
      expect.arrayContaining([expect.objectContaining({ group: 'Hunched shoulders / thoracic kyphosis' })]),
    )
  })

  it('filters the library by goal', async () => {
    // Arrange
    const state = createDefaultStorageState()
    state.exercises = starterExercises.map((exercise, index) => ({
      ...exercise,
      group: index === 0 ? 'Posture' : 'General',
    }))
    writeStorage(state, localStorage)
    const user = userEvent.setup()
    render(<App />)
    await navigateTo(user, 'Exercise Library')

    // Act
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by goal' }), 'Posture')

    // Assert
    expect(screen.getByRole('combobox', { name: 'Filter by goal' })).toHaveValue('Posture')
    expect(screen.getByRole('button', { name: 'Dead bug' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Forearm plank' })).not.toBeInTheDocument()
  })

  it('narrows the library by muscle and user tag independently', async () => {
    // Arrange
    seedExerciseLibrary()
    const user = userEvent.setup()
    render(<App />)
    await navigateTo(user, 'Exercise Library')

    // Act and Assert: a muscle filter includes matching exercises before a tag is selected.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by muscle' }), 'Core')
    expect(screen.getByRole('button', { name: 'Dead bug' })).toBeInTheDocument()

    // Act and Assert: adding a non-matching tag narrows the existing muscle result to none.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by tag' }), 'Squat')
    expect(screen.queryByRole('button', { name: 'Dead bug' })).not.toBeInTheDocument()
    expect(screen.getByText('No exercises match these filters.')).toBeInTheDocument()

    // Act and Assert: the tag filter remains useful independently of the muscle filter.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by muscle' }), 'All')
    expect(screen.getByRole('button', { name: 'Goblet squat' })).toBeInTheDocument()

    // Act and Assert: a matching muscle and tag retain the intended exercise.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by muscle' }), 'Quads')
    expect(screen.getByRole('button', { name: 'Goblet squat' })).toBeInTheDocument()

    // Act and Assert: changing only the tag restores the independent muscle result.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by tag' }), 'All')
    expect(screen.getByRole('button', { name: 'Goblet squat' })).toBeInTheDocument()

    // Act and Assert: changing only the muscle selects the independent muscle result.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by muscle' }), 'Core')
    expect(screen.getByRole('button', { name: 'Dead bug' })).toBeInTheDocument()
  })

  it('persists accessible favorite controls and filters the library to favorites', async () => {
    seedExerciseLibrary()
    const user = userEvent.setup()
    const firstRender = render(<App />)
    await navigateTo(user, 'Exercise Library')

    const deadBugCard = screen.getByRole('article', { name: 'Dead bug' })
    const cardFavorite = within(deadBugCard).getByRole('button', { name: 'Add Dead bug to favorites' })
    expect(cardFavorite).toHaveAttribute('aria-pressed', 'false')
    await user.click(cardFavorite)
    expect(within(deadBugCard).getByRole('button', { name: 'Remove Dead bug from favorites' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('checkbox', { name: 'Show favorites only' }))
    expect(screen.getByRole('checkbox', { name: 'Show favorites only' })).toBeChecked()
    expect(screen.getByRole('article', { name: 'Dead bug' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Forearm plank' })).not.toBeInTheDocument()

    firstRender.unmount()
    render(<App />)
    await navigateTo(user, 'Exercise Library')
    expect(screen.getByRole('checkbox', { name: 'Show favorites only' })).not.toBeChecked()
    expect(within(screen.getByRole('article', { name: 'Dead bug' })).getByRole('button', { name: 'Remove Dead bug from favorites' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Dead bug' }))
    const dialog = screen.getByRole('dialog')
    const dialogFavorite = within(dialog).getByRole('button', { name: 'Remove Dead bug from favorites' })
    await user.click(dialogFavorite)
    expect(within(dialog).getByRole('button', { name: 'Add Dead bug to favorites' })).toHaveAttribute('aria-pressed', 'false')
  })

  // Objective: favorite changes stay synchronized across canonical, routine, and session snapshots.
  it('synchronizes favorites across saved routine and generated-session snapshots without touching unrelated exercises', async () => {
    // Arrange
    const state = createDefaultStorageState()
    state.exercises = starterExercises
    const target = state.exercises.find((exercise) => exercise.id === 'dead-bug')!
    const unrelated = state.exercises.find((exercise) => exercise.id === 'plank')!
    const selections = state.routines[0]!.selections.slice(0, 2).map((selection, index) => ({
      ...selection,
      count: 1,
      exercises: [index === 0 ? target : unrelated],
    }))
    state.routines = [{ ...state.routines[0]!, selections }]
    state.generatedSessions = [{
      scheduleEntryId: 'schedule-1',
      occurrenceDate: '2026-11-15',
      routineId: state.routines[0]!.id,
      selections: selections.map((selection) => ({
        ...selection,
        exercises: selection.exercises.map((exercise) => ({
          ...exercise,
          muscles: [...exercise.muscles],
          instructions: [...exercise.instructions],
          steps: [...exercise.steps],
          commonErrors: exercise.commonErrors.map((pair) => ({ ...pair })),
          tags: [...exercise.tags],
        })),
      })),
    }]
    writeStorage(state, localStorage)
    const user = userEvent.setup()
    render(<App />)
    await navigateTo(user, 'Exercise Library')

    // Act
    await user.click(within(screen.getByRole('article', { name: 'Dead bug' })).getByRole('button', {
      name: 'Add Dead bug to favorites',
    }))

    // Assert
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').data
    expect(persisted.exercises.find((exercise: { id: string }) => exercise.id === 'dead-bug').isFavorite).toBe(true)
    expect(persisted.routines[0].selections[0].exercises[0].isFavorite).toBe(true)
    expect(persisted.generatedSessions[0].selections[0].exercises[0].isFavorite).toBe(true)
    expect(persisted.exercises.find((exercise: { id: string }) => exercise.id === 'plank').isFavorite).toBe(false)
    expect(persisted.routines[0].selections[1].exercises[0].isFavorite).toBe(false)
    expect(persisted.generatedSessions[0].selections[1].exercises[0].isFavorite).toBe(false)
  })

  it('accepts and renders structured exercise metadata in cards and details', async () => {
    const user = userEvent.setup()
    render(<App />)
    await navigateTo(user, 'Exercise Library')
    await user.click(screen.getByRole('button', { name: /Add exercise/i }))

    await user.type(screen.getByLabelText('Exercise name'), 'Metadata hinge')
    await user.type(screen.getByLabelText('Group'), 'Posterior chain')
    await user.type(screen.getByLabelText(/Targeted musclegroups/i), 'Hamstrings, Glutes')
    await user.type(screen.getByLabelText(/Step-by-step movement/i), 'Stand tall\nHinge slowly')
    await user.type(screen.getByLabelText(/Common errors and corrections/i), 'Rounding | Keep ribs stacked.')
    await user.click(screen.getByRole('button', { name: /Save exercise/ }))

    const metadataCard = screen.getByRole('article', { name: 'Metadata hinge' })
    expect(within(metadataCard).getByRole('button', { name: 'Metadata hinge' })).toBeInTheDocument()
    expect(within(metadataCard).getByText('Posterior chain')).toBeInTheDocument()
    expect(within(metadataCard).getByText('Hamstrings')).toBeInTheDocument()
    expect(within(metadataCard).queryByText('Rounding')).not.toBeInTheDocument()
    expect(within(metadataCard).queryByText('A controlled hinge drill.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Metadata hinge' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Hinge slowly')
    expect(screen.getByRole('dialog')).toHaveTextContent('Rounding')
    expect(screen.getByRole('dialog')).toHaveTextContent('Keep ribs stacked.')
  })

  it('filters the library by a specific muscle without changing the muscle-group filter', async () => {
    seedExerciseLibrary()
    const user = userEvent.setup()
    render(<App />)
    await navigateTo(user, 'Exercise Library')

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter by specific muscle' }),
      'musculus rectus abdominis',
    )

    expect(screen.getByRole('button', { name: 'Dead bug' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Goblet squat' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filter by muscle' })).toHaveValue('All')
  })

  it('accepts and displays the complete exercise metadata form', async () => {
    const user = userEvent.setup()
    render(<App />)
    await navigateTo(user, 'Exercise Library')
    await user.click(screen.getByRole('button', { name: /Add exercise/i }))

    await user.type(screen.getByLabelText('Exercise name'), 'Complete metadata drill')
    await user.type(screen.getByLabelText('Group'), 'Motor control')
    await user.type(screen.getByLabelText(/Targeted musclegroups/i), 'Core, Hips')
    await user.type(screen.getByLabelText('Purpose'), 'Build controlled trunk movement.')
    await user.type(screen.getByLabelText(/Specific muscles/i), 'musculus transversus abdominis\nmusculus gluteus medius')
    await user.type(screen.getByLabelText('Equipment and environment'), 'A mat and clear floor space.')
    await user.type(screen.getByLabelText('Starting position and set-up'), 'Start on all fours with hands under shoulders.')
    await user.type(screen.getByLabelText('Range and direction'), 'Reach long without twisting.')
    await user.type(screen.getByLabelText('Breathing'), 'Exhale during the reach; keep breathing.')
    await user.type(screen.getByLabelText('Beginner dose and rest'), 'Two sets of five per side; rest 45 seconds.')
    await user.type(screen.getByLabelText('Expected sensation'), 'Mild trunk effort without sharp pain.')
    await user.type(screen.getByLabelText('Regression'), 'Move one limb at a time.')
    await user.type(screen.getByLabelText('Progression'), 'Hold each reach for eight seconds.')
    await user.type(screen.getByLabelText(/Step-by-step movement/i), 'Set up steadily\nReach opposite limbs')
    await user.type(screen.getByLabelText(/Common errors and corrections/i), 'Twisting | Reduce the reach\nHolding breath | Exhale slowly')
    await user.click(screen.getByRole('button', { name: /Save exercise/ }))

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').data
    expect(persisted.exercises).toEqual(expect.arrayContaining([expect.objectContaining({
       name: 'Complete metadata drill',
       group: 'Motor control',
       purpose: 'Build controlled trunk movement.',
       specificMuscles: ['musculus transversus abdominis', 'musculus gluteus medius'],
       category: 'Motor control',
    })]))

    await user.click(screen.getByRole('button', { name: 'Complete metadata drill' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Core instructions' })).toBeInTheDocument()
    await user.click(within(dialog).getByText('Targeted specific muscles'))
    expect(within(dialog).getByText('musculus gluteus medius')).toBeVisible()
    expect(within(dialog).queryByText('https://example.test/exercise')).not.toBeInTheDocument()
    expect(dialog).toHaveTextContent('Build controlled trunk movement.')
    expect(dialog).toHaveTextContent('musculus gluteus medius')
    expect(dialog).toHaveTextContent('A mat and clear floor space.')
    expect(dialog).toHaveTextContent('Start on all fours with hands under shoulders.')
    expect(dialog).toHaveTextContent('Reach long without twisting.')
    expect(dialog).toHaveTextContent('Exhale during the reach; keep breathing.')
    expect(dialog).toHaveTextContent('Two sets of five per side; rest 45 seconds.')
    expect(dialog).toHaveTextContent('Mild trunk effort without sharp pain.')
    expect(dialog).toHaveTextContent('Move one limb at a time.')
    expect(dialog).toHaveTextContent('Hold each reach for eight seconds.')
    expect(dialog).toHaveTextContent('Motor control')
    expect(dialog).toHaveTextContent('Set up steadily')
    expect(dialog).toHaveTextContent('Reduce the reach')
    expect(within(dialog).getAllByRole('listitem').length).toBeGreaterThanOrEqual(6)
  })

  it('keeps the custom exercise form and draft when storage cannot be written', async () => {
    const user = userEvent.setup()
    render(<App />)
    await navigateTo(user, 'Exercise Library')
    await user.click(screen.getByRole('button', { name: /Add exercise/i }))
    await user.type(screen.getByLabelText('Exercise name'), 'Storage failure exercise')
    await user.type(screen.getByLabelText('Group'), 'Mobility')
    await user.type(screen.getByLabelText(/Targeted musclegroups/i), 'Hips')
    await user.type(screen.getByLabelText(/Step-by-step movement/i), 'Move carefully')

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    await user.click(screen.getByRole('button', { name: /Save exercise/ }))

    expect(screen.getByRole('heading', { name: 'Add an exercise' })).toBeInTheDocument()
    expect(screen.getByLabelText('Exercise name')).toHaveValue('Storage failure exercise')
    expect(screen.getByRole('alert')).toHaveTextContent('Your draft is still here')
  })

  it('does not start a scheduled workout while the exercise library is empty', async () => {
    const state = createDefaultStorageState()
    state.schedule = [{ id: 'wednesday-reset', day: 'wednesday', time: '08:00', routineId: state.routines[0].id }]
    const routinesBeforeStart = JSON.stringify(state.routines)
    writeStorage(state, localStorage)
    localStorage.setItem(LEGACY_EXERCISES_KEY, JSON.stringify([]))
    const user = userEvent.setup()

    const firstRender = render(<App now={new Date(2026, 9, 20, 7, 0)} />)

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({ data: { generatedSessions: [] } })

    await user.click(screen.getByRole('button', { name: 'Start workout' }))

    const startedState = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').data
    expect(startedState.generatedSessions).toEqual([])
    expect(startedState.routines).toEqual(JSON.parse(routinesBeforeStart))
    expect(screen.getByRole('alert')).toHaveTextContent('Add an exercise before starting a workout')
    firstRender.unmount()
  })

  it('shows non-fatal feedback when generating the next workout fails', async () => {
    const state = createDefaultStorageState()
    state.schedule = [{ id: 'wednesday-reset', day: 'wednesday', time: '08:00', routineId: state.routines[0].id }]
    writeStorage(state, localStorage)
    localStorage.setItem(LEGACY_EXERCISES_KEY, JSON.stringify([]))
    vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('randomness unavailable') })
    const user = userEvent.setup()

    render(<App now={new Date(2026, 9, 20, 7, 0)} />)
    await user.click(screen.getByRole('button', { name: 'Start workout' }))

    expect(screen.getByRole('alert')).toHaveTextContent('No session was started')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').data.generatedSessions).toEqual([])
  })

  it('opens the full exercise details when a generated workout exercise is clicked', async () => {
    // Arrange
    const state = createDefaultStorageState()
    state.exercises = starterExercises
    state.routines = [{
      ...state.routines[0]!,
      selections: [{ ...state.routines[0]!.selections[0]!, count: 1, exercises: [] }],
    }]
    state.schedule = [{ id: 'wednesday-reset', day: 'wednesday', time: '08:00', routineId: state.routines[0]!.id }]
    writeStorage(state, localStorage)
    const user = userEvent.setup()
    render(<App now={new Date(2026, 9, 20, 7, 0)} />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Start workout' }))
    const generatedExerciseButton = screen.getByRole('button', { name: /^Open .* details$/ })
    const generatedExerciseName = generatedExerciseButton.textContent ?? ''
    await user.click(generatedExerciseButton)

    // Assert
    expect(screen.getByRole('dialog')).toHaveTextContent(generatedExerciseName)
    expect(screen.getByRole('dialog')).toHaveTextContent('Core instructions')
    expect(screen.getByRole('dialog')).toHaveTextContent('Step-by-step movement')
  })

  it('does not offer a start action when no workout is scheduled', () => {
    // Arrange
    const state = createDefaultStorageState()
    writeStorage(state, localStorage)

    // Act
    render(<App now={new Date(2026, 9, 20, 7, 0)} />)

    // Assert: an empty schedule is an explicit, non-startable dashboard state.
    expect(screen.getByRole('heading', { level: 2, name: 'No workout scheduled' })).toBeInTheDocument()
    expect(screen.getByText('Add an assignment to your schedule when you are ready to plan your next session.'))
      .toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start workout' })).not.toBeInTheDocument()
  })

  it('reports a workout storage failure without showing or persisting a session', async () => {
    // Arrange
    const state = createDefaultStorageState()
    state.schedule = [{ id: 'wednesday-reset', day: 'wednesday', time: '08:00', routineId: state.routines[0].id }]
    writeStorage(state, localStorage)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const user = userEvent.setup()
    render(<App now={new Date(2026, 9, 20, 7, 0)} />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Start workout' }))

    // Assert: the failed write leaves the pre-start state and explains the failure.
    expect(screen.getByRole('alert')).toHaveTextContent('No session was started')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').data.generatedSessions).toEqual([])
  })

  it('does not create recurrence sessions while the exercise library is empty', async () => {
    // Arrange
    const state = createDefaultStorageState()
    state.routines = [{
      ...state.routines[0],
      selections: [{ ...state.routines[0].selections[0], count: 1, exercises: [] }],
    }]
    state.schedule = [{ id: 'wednesday-reset', day: 'wednesday', time: '08:00', routineId: state.routines[0].id }]
    writeStorage(state, localStorage)
    localStorage.setItem(LEGACY_EXERCISES_KEY, JSON.stringify([]))
    const routinesBeforeStart = JSON.stringify(state.routines)
    const user = userEvent.setup()
    const firstRender = render(<App now={new Date(2026, 9, 20, 7, 0)} />)

    // Act: attempt this week's occurrence, then load the following week's occurrence.
    await user.click(screen.getByRole('button', { name: 'Start workout' }))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').data.generatedSessions).toEqual([])
    firstRender.unmount()
    render(<App now={new Date(2026, 9, 27, 7, 0)} />)
    await user.click(screen.getByRole('button', { name: 'Start workout' }))

    // Assert: no empty session is persisted and the routine template remains intact.
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').data.generatedSessions
    expect(sessions).toEqual([])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').data.routines).toEqual(JSON.parse(routinesBeforeStart))
    expect(screen.getByRole('alert')).toHaveTextContent('Add an exercise before starting a workout')
  })

  it('removes deleted routine assignments from the shared schedule state', async () => {
    // Arrange
    const state = createDefaultStorageState()
    const deletedRoutine = { ...state.routines[0], id: 'travel-routine', name: 'Travel day' }
    state.routines = [state.routines[0], deletedRoutine]
    state.schedule = [
      { id: 'kept-assignment', day: 'monday', time: '08:00', routineId: state.routines[0].id },
      { id: 'deleted-assignment', day: 'friday', time: '18:00', routineId: deletedRoutine.id },
    ]
    writeStorage(state, localStorage)
    const user = userEvent.setup()
    render(<App />)
    await navigateTo(user, 'Saved Routines')

    // Act
    const deletedRoutineItem = screen.getByRole('listitem', { name: 'Travel day' })
    await user.click(within(deletedRoutineItem).getByRole('button', { name: 'Delete Travel day' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    // Assert: both persistence and the adapter-backed React state are cascaded.
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      data: { schedule: [{ id: 'kept-assignment' }] },
    })
    await navigateTo(user, 'Schedule')
    expect(screen.queryByText('Travel day')).not.toBeInTheDocument()
    expect(screen.getAllByText('Rest day')).toHaveLength(6)
  })

  // Objective: keep reminder settings useful when browser notification support is absent.
  it('rejects an invalid reminder time without changing the saved reminder', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<App />)
    await navigateTo(user, 'Reminders')

    // Act
    fireEvent.change(screen.getByLabelText('Reminder time'), { target: { value: '25:00' } })

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a valid reminder time.')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      data: { reminders: { time: '09:00', enabled: false } },
    })
  })

  // Objective: regression-test deterministic routine generation and active routine selection.
  it('regenerates the selected routine without losing its focus areas', async () => {
    // Arrange
    seedExerciseLibrary()
    const user = userEvent.setup()
    render(<App />)
    await navigateTo(user, 'Routine Builder')
    const groupsBefore = screen.getAllByRole('heading', { level: 3 })
    const selectedCountsBefore = screen.getAllByText(/\d+ selected$/).map((element) => element.textContent)

    // Act
    await user.click(screen.getByRole('button', { name: /Regenerate all/i }))

    // Assert: regeneration remains within each configured group and keeps the builder populated.
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(
      groupsBefore.map((heading) => heading.textContent),
    )
    expect(screen.getAllByText(/\d+ selected$/).map((element) => element.textContent)).toEqual(selectedCountsBefore)
    expect(screen.getByText('9', { selector: 'strong' })).toBeInTheDocument()
  })

  it('configures focus areas independently', async () => {
    // Arrange
    seedExerciseLibrary()
    const user = userEvent.setup()
    render(<App />)
    await navigateTo(user, 'Routine Builder')

    expect(screen.getByRole('combobox', { name: 'Goal for Core strength' })).toHaveValue('All')
    expect(screen.getByRole('listbox', { name: 'Muscle group for Core strength' })).toHaveValue(['All'])
    expect(screen.getByRole('listbox', { name: 'Specific muscle for Core strength' })).toHaveValue(['All'])
    expect(within(screen.getByRole('listbox', { name: 'Exercise type for Core strength' }))
      .getByRole('option', { name: 'All' })).toBeInTheDocument()

    // Act: select multiple values only for the first group's filters and count.
    await user.selectOptions(screen.getByRole('listbox', { name: 'Exercise type for Core strength' }), ['Strength', 'Stretch'])
    await user.selectOptions(screen.getByRole('listbox', { name: 'Muscle group for Core strength' }), ['Core', 'Hip flexors'])
    await user.selectOptions(screen.getByRole('listbox', { name: 'Specific muscle for Core strength' }), ['musculus iliopsoas', 'musculus transversus abdominis'])
    await user.selectOptions(screen.getByRole('combobox', { name: 'Exercises for Core strength' }), '2')

    // Assert: the first group reflects its own settings while the other groups remain present.
    expect(screen.getByRole('listbox', { name: 'Exercise type for Core strength' })).toHaveValue(['Strength', 'Stretch'])
    expect(screen.getByRole('listbox', { name: 'Muscle group for Core strength' })).toHaveValue(['Core', 'Hip flexors'])
    expect(screen.getByRole('listbox', { name: 'Specific muscle for Core strength' })).toHaveValue(['musculus iliopsoas', 'musculus transversus abdominis'])
    expect(screen.getByRole('combobox', { name: 'Exercises for Core strength' })).toHaveValue('2')
    expect(screen.getByText('3', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Squat variations' })).toBeInTheDocument()

    // Act: change the number of focus areas and remove the newly added one again.
    await user.click(screen.getByRole('button', { name: /Add focus area/i }))

    // Assert: focus-area count is independently adjustable.
    expect(screen.getByRole('heading', { level: 3, name: 'Focus area 4' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove Focus area 4' }))
    expect(screen.queryByRole('heading', { level: 3, name: 'Focus area 4' })).not.toBeInTheDocument()
  })

  it('filters a focus area by goal before selecting its target muscle', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<App />)
    await navigateTo(user, 'Routine Builder')

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Goal for Core strength' }),
      'Hunched shoulders / thoracic kyphosis',
    )

    // Assert
    expect(screen.getByRole('combobox', { name: 'Goal for Core strength' })).toHaveValue('Hunched shoulders / thoracic kyphosis')
    expect(within(screen.getByRole('listbox', { name: 'Muscle group for Core strength' }))
      .queryByRole('option', { name: 'Core' })).not.toBeInTheDocument()
  })

  it('allows the routine and focus-area names to be edited before saving', async () => {
    // Arrange
    seedExerciseLibrary()
    const user = userEvent.setup()
    render(<App />)
    await navigateTo(user, 'Routine Builder')

    // Act
    await user.clear(screen.getByRole('textbox', { name: 'Routine name' }))
    await user.type(screen.getByRole('textbox', { name: 'Routine name' }), 'Travel mobility')
    const focusNameInput = screen.getByRole('textbox', { name: 'Name for Core strength' })
    await user.clear(focusNameInput)
    await user.type(focusNameInput, 'Core reset')

    // Assert: edits are visible in the builder and the routine name is carried into saving.
    expect(screen.getByRole('textbox', { name: 'Routine name' })).toHaveValue('Travel mobility')
    expect(screen.getByRole('textbox', { name: 'Name for Core reset' })).toHaveValue('Core reset')
    await user.click(screen.getByRole('button', { name: /Save or manage routine/i }))
    expect(screen.getByLabelText(/Save the current routine/i)).toHaveValue('Travel mobility')
  })

  // Objective: preserve existing navigation and keep inactive views out of the accessible page.
  it('navigates between every primary view and shows only the active page heading', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<App />)
    const views = ['Dashboard', 'Exercise Library', 'Routine Builder', 'Saved Routines', 'Schedule', 'Reminders']

    // Act and assert: each navigation control selects its page; the previous page is not rendered.
    for (const view of views) {
      await navigateTo(user, view)
      expect(screen.getByRole('heading', { level: 1, name: view })).toBeInTheDocument()
    }
    expect(screen.queryByText('Your movement space')).not.toBeInTheDocument()
  })

  it('marks the current navigation page and renders the current date', () => {
    // Arrange
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0))

    try {
      // Act
      render(<App />)

      // Assert
      expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByText('Tuesday, October 20, 2026')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
