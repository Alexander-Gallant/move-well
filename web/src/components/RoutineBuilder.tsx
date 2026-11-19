import type { ChangeEvent } from 'react'
import {
  getGoals,
  getSelectedRoutineMuscles,
  getSelectedRoutineSpecificMuscles,
  getSelectedRoutineTypes,
  getSpecificMuscles,
  getTargetMuscles,
  type RoutineGroupChanges,
} from '../routine'
import type { Exercise, ExerciseType, ExerciseTypes, RoutineSelection } from '../types'

const exerciseCounts = [1, 2, 3, 4, 5, 6]

type RoutineBuilderProps = {
  exercises: Exercise[]
  onAddGroup: () => void
  onManage: () => void
  onRegenerate: (groupId?: string) => void
  onRemoveGroup: (groupId: string) => void
  onRoutineNameChange: (name: string) => void
  onUpdateGroup: (groupId: string, changes: RoutineGroupChanges) => void
  routine: RoutineSelection[]
  routineName: string
}

const getEstimatedMinutes = (routine: RoutineSelection[]): number => routine
  .flatMap((group) => group.exercises)
  .reduce((total, exercise) => {
    const minutes = Number.parseInt(exercise.duration, 10)
    return total + (Number.isFinite(minutes) ? minutes : 0)
  }, 0)

const getExerciseTypes = (exercise: Exercise): string[] => (
  exercise.types && exercise.types.length > 0 ? [...exercise.types] : [exercise.type]
)

const getAvailableExerciseTypes = (exercises: Exercise[], selectedTypes: readonly ExerciseType[]): ExerciseType[] => [
  'All',
  ...Array.from(new Set([...selectedTypes, ...exercises.flatMap(getExerciseTypes)].filter((type) => type && type !== 'All')))
    .sort((left, right) => left.localeCompare(right)),
]

const getAvailableExerciseGoals = (exercises: Exercise[], selectedGoal: string, selectedTypes: readonly ExerciseType[]): string[] => Array.from(
  new Set(['All', selectedGoal, ...getGoals(exercises, selectedTypes)].filter(Boolean)),
).sort((left, right) => left === 'All' ? -1 : right === 'All' ? 1 : left.localeCompare(right))

const getAvailableExerciseSpecificMuscles = (
  exercises: Exercise[],
  selectedSpecificMuscle: string,
  selectedTypes: readonly ExerciseType[],
  selectedGoal: string,
  selectedMuscles: readonly string[],
): string[] => Array.from(
  new Set(['All', selectedSpecificMuscle, ...getSpecificMuscles(exercises, selectedTypes, selectedGoal, selectedMuscles)].filter(Boolean)),
).sort((left, right) => left === 'All' ? -1 : right === 'All' ? 1 : left.localeCompare(right))

const normalizeSelectedValues = (values: string[]): string[] => {
  const selected = Array.from(new Set(values.filter(Boolean)))
  const specificValues = selected.filter((value) => value !== 'All')
  return specificValues.length > 0 ? specificValues : ['All']
}

const getSelectedValues = (event: ChangeEvent<HTMLSelectElement>): string[] => normalizeSelectedValues(
  Array.from(event.target.selectedOptions, (option) => option.value),
)

function RoutineGroupCard({ group, groupIndex, groupCount, exercises, onRegenerate, onRemoveGroup, onUpdateGroup }: {
  group: RoutineSelection
  groupIndex: number
  groupCount: number
  exercises: Exercise[]
  onRegenerate: (groupId: string) => void
  onRemoveGroup: (groupId: string) => void
  onUpdateGroup: (groupId: string, changes: RoutineGroupChanges) => void
}) {
  const selectedTypes = getSelectedRoutineTypes(group)
  const selectedMuscles = getSelectedRoutineMuscles(group)
  const selectedSpecificMuscles = getSelectedRoutineSpecificMuscles(group)
  const exerciseTypes = getAvailableExerciseTypes(exercises, selectedTypes)
  const selectedGoal = group.goal ?? 'All'
  const exerciseGoals = getAvailableExerciseGoals(exercises, selectedGoal, selectedTypes)
  const availableMuscles = Array.from(new Set(['All', ...selectedMuscles, ...getTargetMuscles(exercises, selectedTypes, selectedGoal)].filter(Boolean)))
    .sort((left, right) => left === 'All' ? -1 : right === 'All' ? 1 : left.localeCompare(right))
  const availableSpecificMuscles = getAvailableExerciseSpecificMuscles(
    exercises,
    selectedSpecificMuscles[0] ?? 'All',
    selectedTypes,
    selectedGoal,
    selectedMuscles,
  )
  const accessibleGroupName = group.label || `Focus area ${groupIndex + 1}`
  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => onUpdateGroup(group.id, { label: event.target.value })
  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => onUpdateGroup(group.id, { types: getSelectedValues(event) as ExerciseTypes })
  const handleGoalChange = (event: ChangeEvent<HTMLSelectElement>) => onUpdateGroup(group.id, { goal: event.target.value })
  const handleMuscleChange = (event: ChangeEvent<HTMLSelectElement>) => onUpdateGroup(group.id, { muscles: getSelectedValues(event) })
  const handleSpecificMuscleChange = (event: ChangeEvent<HTMLSelectElement>) => onUpdateGroup(group.id, { specificMuscles: getSelectedValues(event) })
  const handleCountChange = (event: ChangeEvent<HTMLSelectElement>) => onUpdateGroup(group.id, { count: Number(event.target.value) })

  return (
    <section className="routine-group" aria-labelledby={`${group.id}-title`}>
      <div className="group-heading">
        <span className="group-number">{String(groupIndex + 1).padStart(2, '0')}</span>
        <div>
          <h3 aria-label={accessibleGroupName} id={`${group.id}-title`}>
            <input
              aria-label={`Name for ${accessibleGroupName}`}
              className="group-name-input"
              maxLength={60}
              onChange={handleNameChange}
              value={group.label}
            />
          </h3>
          <p>{group.detail} · {group.exercises.length} selected</p>
        </div>
        <button className="icon-button" onClick={() => onRegenerate(group.id)} type="button" aria-label={`Regenerate ${accessibleGroupName}`}>↻</button>
        <button
          className="remove-group-button"
          disabled={groupCount === 1}
          onClick={() => onRemoveGroup(group.id)}
          type="button"
          aria-label={`Remove ${accessibleGroupName}`}
          title={groupCount === 1 ? 'Keep at least one focus area' : undefined}
        >
          ×
        </button>
      </div>
      <div className="group-controls">
        <label>
          Goal
          <select aria-label={`Goal for ${accessibleGroupName}`} onChange={handleGoalChange} value={selectedGoal}>
            {exerciseGoals.map((goal) => <option key={goal} value={goal}>{goal}</option>)}
          </select>
        </label>
        <label>
          Exercise type
          <select aria-label={`Exercise type for ${accessibleGroupName}`} multiple onChange={handleTypeChange} size={Math.min(4, exerciseTypes.length)} value={selectedTypes}>
            {exerciseTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label>
          Muscle group
          <select aria-label={`Muscle group for ${accessibleGroupName}`} multiple onChange={handleMuscleChange} size={Math.min(4, availableMuscles.length)} value={selectedMuscles}>
            {availableMuscles.map((muscle) => <option key={muscle} value={muscle}>{muscle}</option>)}
          </select>
        </label>
        <label>
          Specific muscle
          <select aria-label={`Specific muscle for ${accessibleGroupName}`} multiple onChange={handleSpecificMuscleChange} size={Math.min(4, availableSpecificMuscles.length)} value={selectedSpecificMuscles}>
            {availableSpecificMuscles.map((muscle) => <option key={muscle} value={muscle}>{muscle}</option>)}
          </select>
        </label>
        <label>
          Exercises
          <select aria-label={`Exercises for ${accessibleGroupName}`} onChange={handleCountChange} value={group.count}>
            {exerciseCounts.map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
      </div>
      <div className="selected-exercises">
        {group.exercises.map((exercise) => (
          <div className="selected-exercise" key={exercise.id}>
            <span className="exercise-dot" />
            <span>{exercise.name}</span>
            <small>{exercise.duration}</small>
          </div>
        ))}
        {group.exercises.length === 0 && <p className="group-empty-state">No matching exercises yet. Choose another target or add one to your library.</p>}
      </div>
    </section>
  )
}

export default function RoutineBuilder({ exercises, onAddGroup, onManage, onRegenerate, onRemoveGroup, onRoutineNameChange, onUpdateGroup, routine, routineName }: RoutineBuilderProps) {
  const exerciseCount = routine.reduce((total, group) => total + group.exercises.length, 0)
  const estimatedMinutes = getEstimatedMinutes(routine)

  return (
    <div className="page-stack">
      <section className="builder-intro">
        <div>
          <span className="eyebrow">Routine generator</span>
          <label className="routine-name-field">
            <span>Routine name</span>
            <input aria-label="Routine name" maxLength={80} onChange={(event) => onRoutineNameChange(event.target.value)} value={routineName} />
          </label>
          <p>Choose the goals, target muscles and exercise count for each group.</p>
        </div>
        <button className="primary-button" onClick={() => onRegenerate()} type="button">↻ Regenerate all</button>
      </section>
      <section className="builder-controls" aria-labelledby="builder-controls-title">
        <div className="builder-controls-heading">
          <div>
            <span className="eyebrow">Build your session</span>
            <h3 id="builder-controls-title">Configure each focus area</h3>
          </div>
          <button className="outline-button" onClick={onAddGroup} type="button">+ Add focus area</button>
        </div>
        <p>Each setting is independent. Changes immediately refresh only that focus area.</p>
      </section>
      <div className="builder-meta">
        <span><strong>{exerciseCount}</strong> exercises</span>
        <span><strong>~{estimatedMinutes}</strong> minutes</span>
        <span><strong>{routine.length}</strong> focus areas</span>
      </div>
      <div className="routine-groups">
        {routine.map((group, index) => (
          <RoutineGroupCard
            exercises={exercises}
            group={group}
            groupCount={routine.length}
            groupIndex={index}
            key={group.id}
            onRegenerate={onRegenerate}
            onRemoveGroup={onRemoveGroup}
            onUpdateGroup={onUpdateGroup}
          />
        ))}
      </div>
      <button className="save-button" onClick={onManage} type="button">Save or manage routine <span>→</span></button>
    </div>
  )
}
