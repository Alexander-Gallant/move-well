# Scientific Exercise Evidence Search and Summary Workflow

This workflow defines a repeatable method for researching physiotherapy, stretching and strengthening interventions for a specific training goal or physical complaint. It is intended to produce an evidence-informed, practical summary rather than an unstructured list of internet recommendations.

The workflow must distinguish between:

- What is reasonably supported by current evidence
- What is uncertain or has only low-certainty support
- What has not shown meaningful benefit or superiority
- What may be inappropriate or unsafe for a particular presentation
- Which questions remain unanswered

This document is an evidence-research workflow, not a substitute for diagnosis or an individual clinical assessment.

## 1. Define the question

Create a written question before searching. Separate a **training goal** from a **clinical complaint**.

### 1.1 Training goal

Use a PECO-style question:

- **Population:** Healthy adults, older adults, beginners, athletes, or another defined group
- **Exposure/intervention:** Strengthening, resistance training, motor-control exercise, stretching, Pilates, walking, or another intervention
- **Comparison:** No exercise, usual activity, another exercise programme, or a different dose
- **Outcomes:** Strength, endurance, hypertrophy, mobility, function, injury prevention, confidence or quality of life

Example:

> In generally healthy adults seeking improved trunk and lower-back strength, which progressive physiotherapy-based strengthening and mobility interventions improve trunk strength, endurance and function?

### 1.2 Clinical complaint

Use a PICO-style question:

- **Population:** Define age, duration and presentation
- **Intervention:** Exercise, physiotherapy, stretching, strengthening or a combined programme
- **Comparison:** Usual care, education, no exercise, or another active intervention
- **Outcomes:** Pain, disability, function, mobility, recurrence, quality of life and adverse events

Example:

> In adults with persistent nonspecific low-back pain, which exercise and physiotherapy interventions improve pain and function compared with usual care, no exercise or another exercise programme?

Always specify whether the complaint is acute, subacute, chronic or recurrent. Separate nonspecific local pain from radicular pain, neurological symptoms, post-operative rehabilitation and diagnosed spinal pathology.

## 2. Perform a safety screen first

Before interpreting or prescribing exercises for a complaint, identify whether the presentation requires medical assessment.

Urgent assessment is appropriate for symptoms such as:

- New bladder or bowel dysfunction
- Saddle numbness
- Progressive leg weakness
- Severe or rapidly worsening neurological symptoms
- Major trauma
- Fever or systemic illness
- A history of cancer with new unexplained pain
- Unexplained weight loss
- Severe non-mechanical or unremitting night pain

Do not apply a generic online exercise list to these presentations. Clearly state the scope and exclusions in every complaint-specific report.

## 3. Use an evidence hierarchy

Search in the following order:

1. Current clinical practice guidelines and consensus statements
2. Systematic reviews and meta-analyses
3. Cochrane reviews and evidence-based physiotherapy reviews
4. Randomized controlled trials published after the latest relevant review
5. Prospective studies for adherence, recurrence, safety or longer-term outcomes
6. Expert books for exercise technique, clinical reasoning, progressions and regressions

Books are useful for describing how to perform an exercise, but a book should not outweigh a high-quality contemporary systematic review when judging whether an intervention improves pain or function. Record the edition, date, author expertise, references and potential conflicts of interest.

## 4. Search sources

Use multiple sources because each has different coverage:

- PubMed/MEDLINE
- PEDro
- Cochrane Library
- Embase
- CINAHL
- SPORTDiscus
- Google Scholar for citation chasing only
- Guideline repositories, including NICE, WHO, APTA and relevant national physiotherapy organisations
- Library catalogues and publisher databases for expert books

Record the search date, database, filters and exact search string. Search results must be reproducible by another person.

## 5. Build searches from concept blocks

Do not rely on one very restrictive search. Search the condition or goal, intervention and evidence type as separate blocks.

### 5.1 Condition or goal terms

For low-back pain, use terms such as:

```text
"low back pain" OR lumbago OR lumbar pain OR "nonspecific low back pain"
```

For a training goal, use terms such as:

```text
core strength OR trunk strength OR lumbar endurance OR lumbopelvic control
```

Add duration terms where relevant:

```text
acute OR subacute OR chronic OR recurrent
```

### 5.2 Intervention terms

```text
exercise therapy
OR physiotherapy
OR physical therapy
OR resistance training
OR strengthening
OR motor control exercise
OR spinal stabilization
OR trunk exercise
OR stretching
OR flexibility training
OR Pilates
OR yoga
OR aerobic exercise
```

Do not search only for `core stability`. Terminology is inconsistent, and relevant research may use trunk exercise, motor-control exercise, resistance training, lumbar endurance or lumbopelvic control instead.

### 5.3 Evidence-type terms

```text
systematic review
OR meta-analysis
OR clinical practice guideline
OR randomized controlled trial
OR consensus statement
```

### 5.4 Example PubMed search

```text
(
  "low back pain"[Title/Abstract]
  OR lumbago[Title/Abstract]
  OR "nonspecific low back pain"[Title/Abstract]
)
AND
(
  "Exercise Therapy"[MeSH Terms]
  OR strengthening[Title/Abstract]
  OR "motor control"[Title/Abstract]
  OR stabilization[Title/Abstract]
  OR stretching[Title/Abstract]
  OR physiotherapy[Title/Abstract]
)
AND
(
  systematic review[Publication Type]
  OR meta-analysis[Publication Type]
  OR guideline[Title/Abstract]
  OR randomized controlled trial[Publication Type]
)
```

Run additional searches rather than overloading the first query. Useful additional questions include:

- Does exercise prevent recurrence?
- What dose and frequency are effective?
- Is supervised exercise better than home exercise?
- Are stretching-only programmes effective?
- Are specific exercise systems superior to general strengthening?
- What are the adverse events and contraindications?
- What improves adherence?
- What is known for older adults, athletes or people with neurological symptoms?

## 6. Set inclusion and exclusion criteria before screening

### Include

- Adults or a clearly defined target population
- A reproducible exercise or physiotherapy intervention
- Meaningful outcomes such as pain, disability, function, strength, mobility, recurrence or quality of life
- Current guidelines and transparent systematic reviews
- Randomized trials with an appropriate comparator
- Studies reporting intervention dose, supervision or progression where possible

### Exclude or report separately

- Post-operative populations unless specifically relevant
- Pregnancy-related pain unless specifically relevant
- Fracture, infection, malignancy or inflammatory disease unless specifically relevant
- Highly sport-specific injuries when the question is general
- Interventions that combine several treatments without isolating the exercise effect
- Studies with insufficient intervention details for practical replication

Mixed interventions, such as exercise plus manual therapy, must be identified separately from exercise alone.

## 7. Screen and appraise the evidence

For every important source, extract:

| Field | Record |
|---|---|
| Citation | Authors, title, journal, year and DOI or URL |
| Source type | Guideline, systematic review, meta-analysis, RCT, cohort or book |
| Population | Age, symptoms, duration, severity and relevant exclusions |
| Intervention | Exercise category, exact exercises and setting |
| Comparator | Usual care, no exercise or another active programme |
| Dose | Frequency, intensity, duration, supervision and progression |
| Outcomes | Pain, disability, function, strength, mobility, recurrence and adverse events |
| Result | Direction, size and clinical relevance of the effect |
| Certainty | High, moderate, low or very low |
| Limitations | Bias, heterogeneity, imprecision, short follow-up or poor adherence data |
| Applicability | Whether the evidence matches the intended user or complaint |

Use established appraisal tools where possible:

- **AMSTAR 2** for systematic reviews
- **GRADE** for certainty of evidence
- **RoB 2** for randomized trials
- **AGREE II** for clinical guidelines
- **PEDro** as a useful physiotherapy-specific screening tool

Do not treat a numerical quality score as a replacement for examining the study methods.

## 8. Judge clinical importance, not only statistical significance

For each result, ask:

- Is the effect statistically significant?
- Is it large enough to matter to a patient or trainee?
- Is it sustained beyond the intervention period?
- Is it better than another realistic exercise option?
- Are benefits worth the time, cost and burden?
- Were harms, dropouts and adherence reported?

Exercise versus no treatment often produces a different result from one reasonable exercise programme versus another. This distinction must be stated explicitly.

## 9. Synthesize findings using consistent categories

Avoid unsupported absolute statements such as “this exercise works” or “that exercise is useless.” Use the following categories.

### Supported

Evidence consistently indicates benefit with reasonable certainty and clinical relevance.

### Probably beneficial

Evidence generally favors the intervention, but studies are heterogeneous or effects are modest.

### No clear superiority

The intervention may be useful, but it has not convincingly outperformed other reasonable exercise approaches.

### Uncertain

Results are inconsistent, imprecise or based mainly on low-quality studies.

### Not supported as a standalone intervention

Evidence does not show meaningful benefit when used alone, or does not show benefit beyond minimal care.

### Potentially inappropriate

The intervention may be unsuitable for a particular presentation, symptom pattern or stage of rehabilitation.

“Not proven superior” must not be translated into “useless.” If multiple interventions have similar average effects, selection should consider symptoms, preference, access, confidence, equipment and adherence.

## 10. Write the evidence summary by intervention category

Use the same structure for every category:

### Intervention category

**What is known**

- Summarize consistent findings.
- State the population and comparator.
- Report the certainty and approximate clinical importance.

**What is uncertain**

- Identify inconsistent outcomes, heterogeneous programmes or imprecise estimates.

**What is not supported or not superior**

- State when an intervention has not outperformed other reasonable options.
- Avoid claiming that absence of evidence proves absence of effect.

**Safety and practical considerations**

- Describe adverse events, symptom modification and required supervision.

**Implication for practice**

- Explain how the findings should influence exercise selection and progression.

Apply this structure to categories such as:

- General strengthening and resistance training
- Motor-control and stabilization exercise
- Trunk and hip endurance training
- Walking and aerobic exercise
- Stretching and flexibility work
- Pilates or yoga
- Manual therapy when combined with exercise
- Education and self-management
- Ergonomics and posture advice
- Recurrence prevention

## 11. Construct the exercise menu

The final exercise section should provide a broad but organized menu rather than an indiscriminate list. Group exercises by movement demand and provide variations so they can be rotated across sessions.

### Suggested exercise families

#### Low-load trunk control

- Diaphragmatic breathing
- Supine abdominal brace
- Brace with heel slide
- Bent-knee fallout
- Supine marching
- Dead-bug variations

#### Spinal and pelvic control

- Pelvic tilts
- Quadruped weight shifts
- Bird-dog
- Side plank from knees
- Full side plank
- Front plank variations

#### Hip and posterior-chain strength

- Glute bridge
- Marching bridge
- Single-leg bridge
- Hip-hinge drill
- Romanian deadlift pattern
- Dumbbell or kettlebell deadlift
- Sit-to-stand
- Squat to box
- Split squat
- Step-up
- Hip thrust

#### Anti-rotation and loaded carries

- Pallof press
- Half-kneeling Pallof press
- Anti-rotation hold
- Suitcase carry
- Farmer carry
- Offset carry
- Cable lift or chop

#### Mobility and stretching

- Hip-flexor stretch
- Hamstring stretch
- Gluteal stretch
- Quadriceps stretch
- Adductor stretch
- Thoracic rotation
- Cat-camel through a comfortable range
- Comfortable lumbar rotation

#### Functional conditioning

- Walking
- Incline walking
- Cycling
- Step-ups
- Loaded carries
- Sled push or pull
- Progressive lifting from an elevated surface

Stretching should be described as a possible tool for comfort, mobility or preparation. Do not automatically present it as correcting the presumed cause of back pain.

## 12. Use a standard description for every exercise

Each exercise entry should include:

```text
Name:
Purpose:
Exercise type:
Targeted musclegroups:
Targeted specific muscles:
Equipment and environment:
Starting position and set-up:
Step-by-step movement:
Range and direction:
Breathing:
Beginner dose and rest:
Expected sensation:
Regression:
Progression:
Common errors and corrections:
Evidence category:
Evidence strength:
Source:
```

### Novice-complete description requirements

The exercise description must be complete enough for a person with no exercise or physiotherapy background to understand and safely attempt the movement. Do not rely on the exercise name, a specialist term, or a link to supply essential instructions.

For every exercise, explicitly describe:

- **Equipment and environment:** Required equipment, available alternatives, surface, support and space needed
- **Starting position:** The position of every relevant body region, where to place hands and feet, and how far from a wall, chair, bench or anchor to stand
- **Set-up checks:** What should feel stable or supported before starting
- **Step-by-step movement:** Numbered instructions covering the complete movement from start to finish
- **Range and direction:** Which body parts move, which should remain relatively steady, and what a comfortable range looks like
- **Breathing:** When to inhale and exhale, and an instruction not to hold the breath unless specifically justified
- **Repetitions, sets and rest:** A concrete beginner starting point plus how to count a repetition or timed hold
- **Expected sensation:** The difference between manageable effort or a mild stretch and warning symptoms
- **Common mistakes:** At least two observable errors and how to correct them
- **Regression:** The easiest safe version, including how to reduce range, load, balance demand or duration
- **Progression:** One or more ways to increase demand, with the condition that the easier version is controlled first
- **Exercise type:** Classify the exercise, for example strength, motor-control, mobility, stretching, aerobic, balance, functional or plyometric
- **Targeted musclegroups:** List the larger muscle groups targeted, separated by semicolons
- **Targeted specific muscles:** List an exhaustive practical list of the specifically targeted or materially stabilizing muscles, using classic Latin anatomical names and separating each muscle with a semicolon
- **Purpose and evidence:** What capacity the exercise trains and whether the evidence applies to the exercise itself or only to its broader exercise category

Use plain language first and put technical terms in parentheses only when useful. Prefer instructions such as “place your feet hip-width apart, about one foot from the chair” over “assume a neutral lumbopelvic position.” When an exact position varies by person, state that variation explicitly and explain how to choose a comfortable starting position.

Do not include `Self-check`, `How to monitor symptoms` or `Stop or modify if` as fields in individual exercise entries. Put general safety, symptom response and referral guidance in the report-level safety or monitoring sections instead.

Use semicolons consistently in both muscle fields. “Targeted specific muscles” should use classic Latin names, for example `musculus gluteus maximus; musculus gluteus medius; musculus quadriceps femoris` rather than common English names. The list should be anatomically comprehensive for the exercise's intended action, while acknowledging that exercise recruitment is not exclusive to one muscle list.

### Example format

```text
Name: Bird-dog
Purpose: Practise controlled movement of the hips and shoulders while the trunk remains comfortable and steady
Exercise type: Motor-control and endurance
Targeted musclegroups: Trunk stabilisers; shoulder stabilisers; hip extensors
Targeted specific muscles: musculus transversus abdominis; musculus multifidus; musculus obliquus externus abdominis; musculus obliquus internus abdominis; musculus gluteus maximus; musculus deltoideus; musculus serratus anterior
Equipment and environment: An exercise mat or carpet; a wall or sturdy bench can be used for an easier version
Starting position and set-up: Kneel on all fours with hands directly below or slightly in front of the shoulders, knees below the hips, fingers pointing forward, and toes relaxed or tucked under. Look at the floor a short distance in front of the hands. Spread the fingers, keep the elbows softly unlocked, and distribute weight evenly between the hands and knees. The spine should be in a comfortable middle position, not forced flat or rigid.
Step-by-step movement: (1) Breathe in and gently prepare the abdomen without sucking it in hard. (2) Slowly slide one foot backward until the leg is straight, or lift it only a few centimetres. (3) If that is controlled, reach the opposite hand forward. (4) Hold briefly, then lower the hand and foot quietly. (5) Repeat on the other side.
Range and direction: Reach long rather than high. The pelvis should stay broadly level, but small natural movement is acceptable. Stop the reach before the lower back arches or the body twists.
Breathing: Breathe normally throughout; exhale slowly as the arm or leg moves and never hold the breath to create stiffness.
Beginner dose and rest: 1–2 sets of 5 controlled repetitions per side, holding each repetition for 3–5 seconds, with about 30–60 seconds rest between sets.
Expected sensation: Mild effort in the trunk, hips or shoulders is expected. The movement should not produce sharp, electric, spreading or progressively increasing pain.
Regression: Keep both hands on the floor and move one leg only; alternatively, slide the foot along the floor. A wall-supported version can be used if kneeling is uncomfortable.
Progression: Increase the hold to 8–10 seconds, make the movement slower, or add light resistance only after the basic version is controlled without breath-holding or twisting.
Common errors and corrections: Arching the lower back—reach lower and shorten the leg lever; rotating the pelvis—reduce the range and imagine balancing a glass of water on the lower back; shrugging—push the floor away gently; rushing—pause and move more slowly.
Evidence category: Motor-control and trunk endurance
Evidence strength: Evidence supports motor-control exercise as one reasonable exercise approach, but not this individual exercise as uniquely superior.
Source: Cite the relevant motor-control systematic review or guideline; use exercise-therapy books only for technique and progression details.
```

Dosage is a starting range, not a universal prescription. It should be adjusted according to symptoms, movement quality, capacity, goals and recovery.

## 13. Organize progressions and regressions

Use a staged structure when appropriate:

### Level 1: Low-load or irritable presentation

- Comfortable walking
- Breathing and gentle abdominal work
- Pelvic movement
- Isometric gluteal or abdominal work
- Supported bridge
- Short-range hip hinge

### Level 2: Foundational control and strength

- Dead bug
- Bird-dog
- Side plank from knees
- Bridge
- Sit-to-stand
- Step-up
- Pallof press

### Level 3: Progressive loading

- Full plank
- Full side plank
- Split squat
- Romanian deadlift
- Loaded carry
- Hip thrust
- Cable anti-rotation

### Level 4: Higher-demand conditioning

- Heavy carries
- Unilateral deadlift
- Loaded squat
- Trap-bar or other deadlift variation
- Dynamic step-up
- Rotational or sport-specific loading

Progress based on symptom response, next-day recovery, movement quality, confidence, repetition reserve and functional goals—not on a fixed calendar alone.

## 14. Required final report structure

Every completed evidence report should use this structure:

1. **Question and scope**
2. **Population and exclusions**
3. **Safety and referral considerations**
4. **Search date and databases**
5. **Exact search strings**
6. **Inclusion and exclusion criteria**
7. **Evidence hierarchy and appraisal methods**
8. **Key guidelines and reviews**
9. **What is known to help**
10. **What is uncertain**
11. **What is not supported or not clearly superior**
12. **Knowledge gaps**
13. **Practical implications**
14. **Summary report file**, saved as an `.odt` under `schemas/summaries/`
15. **Separate exercise catalogue**, saved as an `.ods` under `schemas/exercises/`
16. **Adherence and report-level symptom monitoring guidance**
17. **References with links or identifiers**
18. **Limitations and date for updating the search**

## 15. Example conclusion style

Use qualified, clinically useful language:

> Current evidence supports remaining active and using individualized, progressive exercise for persistent nonspecific low-back pain. Strengthening, motor-control exercise, walking, Pilates and other structured programmes may all provide modest benefits, but no single exercise system is consistently superior. Stretching may help short-term comfort or mobility but is not clearly sufficient as a standalone treatment. A practical programme should therefore be selected according to symptoms, goals, preference, capacity, access and adherence.

## 16. Updating the evidence

Record the date on which the search was completed. Re-run the search when:

- A major guideline is updated
- A new high-quality systematic review appears
- The question changes population or clinical scope
- The existing review is more than two to three years old for a rapidly developing topic
- New safety concerns arise

Retain the previous search string and evidence table so that changes between versions can be identified.

## 17. Date-stamped split output filenames

Every query that produces both an evidence summary and an exercise catalogue must create two separate report files. Each filename must include its document role, topic and creation date using the `YYYY-MM-DD` format:

```text
schemas/summaries/summary-<topic-slug>-YYYY-MM-DD.odt
schemas/exercises/exercises-<topic-slug>-YYYY-MM-DD.ods
```

These output directories are mandatory relative to the project root:

- Save the overview/evidence summary only in `schemas/summaries/`.
- Save the exercise catalogue only in `schemas/exercises/`.
- Create either directory if it does not yet exist.
- Do not save these output files in `schemas/` itself or in the other output directory.

Use lowercase kebab-case for the topic slug and preserve the appropriate file extension. For example:

```text
schemas/summaries/summary-lower-back-pain-2026-11-11.odt
schemas/exercises/exercises-lower-back-pain-2026-11-11.ods
```

The summary `.odt` file contains the question, safety scope, search strategy, evidence synthesis, practical implications, limitations and references. The exercise `.ods` file is a transposed catalogue: column A contains the 18 exercise field labels in the required order, and each subsequent column contains one complete exercise. The date is the date the report file is created, not necessarily the date of the newest source. Record the search date and report date inside both documents where the format supports them; the exercise catalogue should retain the source/report dates in its document metadata or accompanying summary.

Before delivery, validate that:

- Both output files exist at their required paths: one in `schemas/summaries/` and one in `schemas/exercises/`
- The summary output has the `.odt` extension and the exercise output has the `.ods` extension
- Neither output contains the literal text `None` or other serialization artefacts
- The summary and exercise content are in the correct separate files
- The ODS exercise catalogue opens as a valid OpenDocument Spreadsheet with one field-label column, one column per exercise, and all 18 fields in the required order
- Every exercise uses the required field order and has a non-empty value for each required field
- No individual exercise contains `Self-check`, `How to monitor symptoms` or `Stop or modify if`
- Both muscle fields use semicolon separators and the specific-muscle field uses classic Latin names
