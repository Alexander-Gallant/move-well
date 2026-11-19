import type { Exercise, RoutineGroup } from './types'

type ExerciseDescriptionFields =
  | 'purpose'
  | 'specificMuscles'
  | 'equipmentAndEnvironment'
  | 'startingPosition'
  | 'rangeAndDirection'
  | 'breathing'
  | 'beginnerDoseAndRest'
  | 'expectedSensation'
  | 'regression'
  | 'progression'

type StarterExerciseDefinition = Omit<Exercise, 'group' | 'steps' | 'commonErrors' | 'tags' | 'isFavorite' | ExerciseDescriptionFields>

const starterSpecificMuscles: Record<string, string[]> = {
  'dead-bug': [
    'musculus transversus abdominis',
    'musculus rectus abdominis',
    'musculus obliquus externus abdominis',
    'musculus obliquus internus abdominis',
    'musculus iliopsoas',
  ],
  plank: [
    'musculus transversus abdominis',
    'musculus rectus abdominis',
    'musculus obliquus externus abdominis',
    'musculus gluteus maximus',
    'musculus serratus anterior',
  ],
  'hollow-hold': [
    'musculus rectus abdominis',
    'musculus transversus abdominis',
    'musculus obliquus externus abdominis',
    'musculus iliopsoas',
    'musculus quadriceps femoris',
  ],
  'bird-dog': [
    'musculus transversus abdominis',
    'musculus multifidus',
    'musculus gluteus maximus',
    'musculus deltoideus',
    'musculus serratus anterior',
  ],
  'goblet-squat': [
    'musculus quadriceps femoris',
    'musculus gluteus maximus',
    'musculus gluteus medius',
    'musculus adductor magnus',
    'musculus erector spinae',
  ],
  'split-squat': [
    'musculus quadriceps femoris',
    'musculus gluteus maximus',
    'musculus gluteus medius',
    'musculus adductor magnus',
    'musculus soleus',
  ],
  'tempo-squat': [
    'musculus quadriceps femoris',
    'musculus gluteus maximus',
    'musculus gluteus medius',
    'musculus adductor magnus',
    'musculus erector spinae',
  ],
  'lateral-lunge': [
    'musculus gluteus maximus',
    'musculus gluteus medius',
    'musculus adductor longus',
    'musculus quadriceps femoris',
    'musculus biceps femoris',
  ],
  'pike-push-up': [
    'musculus deltoideus',
    'musculus triceps brachii',
    'musculus pectoralis major',
    'musculus serratus anterior',
    'musculus rectus abdominis',
  ],
  'incline-push-up': [
    'musculus pectoralis major',
    'musculus deltoideus',
    'musculus triceps brachii',
    'musculus serratus anterior',
    'musculus transversus abdominis',
  ],
  'wall-slide': [
    'musculus deltoideus',
    'musculus trapezius',
    'musculus serratus anterior',
    'musculus infraspinatus',
    'musculus rhomboideus major',
  ],
  'doorway-chest': [
    'musculus pectoralis major',
    'musculus pectoralis minor',
    'musculus deltoideus',
    'musculus biceps brachii',
  ],
  'hamstring-fold': [
    'musculus biceps femoris',
    'musculus semitendinosus',
    'musculus semimembranosus',
    'musculus gastrocnemius',
    'musculus gluteus maximus',
  ],
  'hip-flexor-lunge': [
    'musculus iliopsoas',
    'musculus rectus femoris',
    'musculus sartorius',
    'musculus tensor fasciae latae',
    'musculus gluteus maximus',
  ],
}

const starterExerciseDefinitions: StarterExerciseDefinition[] = [
  {
    id: 'dead-bug',
    name: 'Dead bug',
    type: 'Strength',
    muscles: ['Core'],
    category: 'Core',
    description: 'Build trunk control while moving opposite limbs slowly.',
    instructions: [
      'Lie on your back with your arms reaching up and knees bent over your hips.',
      'Brace your core and slowly lower your right arm and left leg toward the floor.',
      'Return to the starting position, then switch sides without arching your back.',
      'Move slowly and keep your lower back gently connected to the floor.',
    ],
    duration: '3 min',
  },
  {
    id: 'plank',
    name: 'Forearm plank',
    type: 'Strength',
    muscles: ['Core', 'Shoulders'],
    category: 'Core',
    description: 'A steady isometric hold for full-body tension.',
    instructions: [
      'Place your forearms on the floor with elbows under your shoulders.',
      'Extend your legs back and tuck your toes, lifting your knees off the floor.',
      'Squeeze your glutes and brace your core so your body forms a straight line.',
      'Breathe steadily while keeping your hips from lifting or dropping.',
    ],
    duration: '2 min',
  },
  {
    id: 'hollow-hold',
    name: 'Hollow body hold',
    type: 'Strength',
    muscles: ['Core'],
    category: 'Core',
    description: 'Challenge deep abdominal strength with a compact hold.',
    instructions: [
      'Lie on your back and lift your shoulders and legs slightly off the floor.',
      'Reach your arms forward and keep your ribs gently pulled down.',
      'Hold the shape with your lower back lightly pressed into the floor.',
      'Bend your knees or raise your legs to make the hold easier.',
    ],
    duration: '2 min',
  },
  {
    id: 'bird-dog',
    name: 'Bird dog',
    type: 'Strength',
    muscles: ['Core', 'Back'],
    category: 'Core',
    description: 'Train balance and spinal control from an all-fours position.',
    instructions: [
      'Start on your hands and knees with your hands under your shoulders.',
      'Brace your core and extend your right arm and left leg at the same time.',
      'Pause when your arm and leg are level with your body, then return slowly.',
      'Repeat on the other side while keeping your hips square to the floor.',
    ],
    duration: '3 min',
  },
  {
    id: 'goblet-squat',
    name: 'Goblet squat',
    type: 'Strength',
    muscles: ['Quads', 'Glutes'],
    category: 'Squat',
    description: 'A front-loaded squat variation with an upright torso.',
    instructions: [
      'Hold a weight close to your chest with both hands and stand with feet shoulder-width apart.',
      'Push your hips back and bend your knees, keeping your chest lifted.',
      'Lower until comfortable while keeping your knees tracking over your toes.',
      'Drive through your feet to stand tall and squeeze your glutes at the top.',
    ],
    duration: '4 min',
  },
  {
    id: 'split-squat',
    name: 'Split squat',
    type: 'Strength',
    muscles: ['Quads', 'Glutes'],
    category: 'Squat',
    description: 'Build single-leg strength with a stable, controlled stance.',
    instructions: [
      'Stand in a split stance with one foot forward and both feet pointing ahead.',
      'Lower your hips straight down by bending both knees.',
      'Keep your front knee over your ankle and your torso tall.',
      'Press through your front foot to return to standing, then switch sides.',
    ],
    duration: '4 min',
  },
  {
    id: 'tempo-squat',
    name: 'Tempo squat',
    type: 'Strength',
    muscles: ['Quads', 'Glutes'],
    category: 'Squat',
    description: 'Slow down the lowering phase to increase time under tension.',
    instructions: [
      'Stand with your feet about shoulder-width apart and brace your core.',
      'Lower into a squat over a slow count of three, sending your hips back.',
      'Pause briefly at the bottom without relaxing your posture.',
      'Press through the floor to stand, keeping the movement controlled.',
    ],
    duration: '4 min',
  },
  {
    id: 'lateral-lunge',
    name: 'Lateral lunge',
    type: 'Strength',
    muscles: ['Glutes', 'Adductors'],
    category: 'Squat',
    description: 'Add frontal-plane movement to a lower-body session.',
    instructions: [
      'Stand tall with your feet together and keep your toes facing forward.',
      'Step to the right and bend your right knee while pushing your hips back.',
      'Keep your left leg long and your chest lifted as you lower comfortably.',
      'Push through your right foot to return to centre, then repeat on the left.',
    ],
    duration: '4 min',
  },
  {
    id: 'pike-push-up',
    name: 'Pike push-up',
    type: 'Strength',
    muscles: ['Shoulders', 'Chest'],
    category: 'Upper body',
    description: 'A bodyweight press that emphasizes the shoulders.',
    instructions: [
      'Start in a high plank, then lift your hips into an upside-down V shape.',
      'Bend your elbows and lower the top of your head toward the floor.',
      'Keep your elbows angled slightly back and your core braced.',
      'Press through your hands to return to the starting position.',
    ],
    duration: '3 min',
  },
  {
    id: 'incline-push-up',
    name: 'Incline push-up',
    type: 'Strength',
    muscles: ['Chest', 'Shoulders'],
    category: 'Upper body',
    description: 'A scalable pressing pattern for the chest and triceps.',
    instructions: [
      'Place your hands on a sturdy surface and walk your feet back into a straight line.',
      'Brace your core and bend your elbows to lower your chest toward the surface.',
      'Keep your elbows angled about 45 degrees from your body.',
      'Press through your hands to return to the start without shrugging your shoulders.',
    ],
    duration: '3 min',
  },
  {
    id: 'wall-slide',
    name: 'Wall slide',
    type: 'Strength',
    muscles: ['Shoulders', 'Back'],
    category: 'Upper body',
    description: 'Improve shoulder control through a gentle range of motion.',
    instructions: [
      'Stand with your back against a wall, feet slightly forward, and ribs relaxed.',
      'Bend your elbows to 90 degrees and place the backs of your arms near the wall.',
      'Slide your arms upward as far as you can without arching your back.',
      'Lower your arms slowly and keep the movement smooth and pain-free.',
    ],
    duration: '3 min',
  },
  {
    id: 'doorway-chest',
    name: 'Doorway chest stretch',
    type: 'Stretch',
    muscles: ['Chest', 'Shoulders'],
    category: 'Upper body',
    description: 'Open the front of the shoulders and chest.',
    instructions: [
      'Stand beside a doorway and place one forearm against the frame.',
      'Keep your elbow near shoulder height and take a small step forward.',
      'Turn your chest gently away until you feel a comfortable stretch.',
      'Breathe slowly, then switch sides without forcing the range of motion.',
    ],
    duration: '2 min',
  },
  {
    id: 'hamstring-fold',
    name: 'Standing hamstring fold',
    type: 'Stretch',
    muscles: ['Hamstrings'],
    category: 'Posterior chain',
    description: 'A relaxed forward fold for the back of the legs.',
    instructions: [
      'Stand with your feet hip-width apart and keep a soft bend in your knees.',
      'Hinge forward from your hips, letting your arms reach toward the floor.',
      'Relax your neck and stop when you feel a gentle stretch in your hamstrings.',
      'Take slow breaths, then roll back up by stacking your spine gradually.',
    ],
    duration: '2 min',
  },
  {
    id: 'hip-flexor-lunge',
    name: 'Half-kneeling hip flexor stretch',
    type: 'Stretch',
    muscles: ['Hip flexors'],
    category: 'Posterior chain',
    description: 'Lengthen the front of the hip while keeping the ribs stacked.',
    instructions: [
      'Kneel with your right knee down and your left foot planted in front.',
      'Tuck your pelvis slightly and brace your core to keep your ribs over your hips.',
      'Shift your hips forward until you feel a gentle stretch in the right hip.',
      'Hold without leaning back, then switch sides.',
    ],
    duration: '2 min',
  },
]

const createStarterDescription = (exercise: StarterExerciseDefinition): Pick<Exercise, ExerciseDescriptionFields> => ({
  purpose: exercise.description,
  specificMuscles: [...(starterSpecificMuscles[exercise.id] ?? ['musculus transversus abdominis'])],
  equipmentAndEnvironment: 'Use a stable, comfortable surface and enough clear space to move safely; no special equipment is required.',
  startingPosition: `Begin in a comfortable, supported position for ${exercise.name}; set the hands, feet and spine before moving.`,
  rangeAndDirection: 'Move slowly through a comfortable range in the described direction; keep the non-moving areas steady and do not force the end position.',
  breathing: 'Breathe continuously, exhaling during the effort, and do not hold the breath.',
  beginnerDoseAndRest: 'Begin with 1–2 sets of 5–10 controlled repetitions or 20–30 seconds, resting about 30–60 seconds between sets.',
  expectedSensation: 'Expect manageable muscular effort or a mild stretch. Sharp, electric, spreading or progressively worsening symptoms are not expected.',
  regression: 'Reduce the range, duration or leverage, and use extra support until the movement can be controlled comfortably.',
  progression: 'Increase the range, duration, repetitions or light resistance only after the easier version is controlled without breath-holding or compensating.',
})

export const starterExercises: Exercise[] = starterExerciseDefinitions.map((exercise) => ({
  ...exercise,
  ...createStarterDescription(exercise),
  group: 'General',
  steps: [...exercise.instructions],
  commonErrors: [],
  tags: [exercise.category],
  isFavorite: false,
}))

/**
 * The catalogue remains available at its import boundary, but the app starts
 * with an intentionally empty library. User-created exercises are
 * added through the library form and persisted by the storage layer.
 */
export const exerciseLibrary: Exercise[] = []

/** Alias for callers that refer to the canonical library as the full collection. */
export const allExercises = exerciseLibrary

export const starterRoutineGroups: RoutineGroup[] = [
  {
    id: 'core',
    label: 'Core strength',
    detail: 'Build a strong centre',
    type: 'Strength',
    goal: 'All',
    muscle: 'All',
    specificMuscle: 'All',
    count: 3,
  },
  {
    id: 'squats',
    label: 'Squat variations',
    detail: 'Strengthen your lower body',
    type: 'Strength',
    goal: 'All',
    muscle: 'All',
    specificMuscle: 'All',
    count: 3,
  },
  {
    id: 'upper-body',
    label: 'Delts & pecs',
    detail: 'Press, stabilise and control',
    type: 'Strength',
    goal: 'All',
    muscle: 'All',
    specificMuscle: 'All',
    count: 3,
  },
]
