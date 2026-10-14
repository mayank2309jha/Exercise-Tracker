# Progress Log

A running record of everything built in this project, newest first.

---

## 2026-10-14 — v1.0: full exercise-tracking app

The simple HTML/CSS/JS calculator was replaced with a React + TypeScript app built to the product spec. The original 3-file version is kept in [`legacy/`](legacy/).

### How to run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 89 unit + UI tests
npm run build      # production build in dist/
npm run preview    # serve the production build
```

### Stack

- React 18, TypeScript (strict), Vite 6, Tailwind CSS 3, Recharts 2, Zod 3, lucide-react icons
- Vitest 3 + Testing Library (jsdom) for tests
- Data is stored in browser `localStorage`, validated with Zod on load and import. No backend, accounts or paid services.

### Project layout

| Path | What it holds |
|---|---|
| `src/domain/types.ts` | Data model: UserProfile, BodyMeasurement, ExerciseDefinition, HistoricalRecord, WorkoutSession, ExerciseEntry, ExerciseSet, ActivityInterval, CalorieEstimate, PersonalRecord, WorkoutTemplate, DailyActivitySummary, Goal, AppSettings |
| `src/domain/met.ts` | MET database (Compendium 2011 codes, plus proxies where no exact entry exists) |
| `src/domain/calories.ts` | Calorie engine (formula version `2026.10.1`) |
| `src/domain/time.ts` | Timer state machine and time accounting |
| `src/domain/strength.ts` | Load normalisation, reps, volume, best set, e1RM |
| `src/domain/body.ts` | Weight on a date, smoothed trend, age, Navy body-fat estimate |
| `src/domain/session.ts` | Builders, recalculation, validation, duplicate detection |
| `src/domain/aggregate.ts` | Filters, weekly/monthly totals, step reconciliation, PRs, chart series |
| `src/data/seed.ts` | Preloaded profile, weights, exercise library, historical records, imported sessions, templates, goals |
| `src/data/schema.ts` | Zod validation for storage and imports |
| `src/data/persistence.ts` | localStorage load/save, migration hook, backup of corrupt data |
| `src/data/io.ts` | JSON and CSV export/import |
| `src/data/store.tsx` | React context store |
| `src/components/` | UI kit, charts, timer bar, entry editor, exercise picker, layout |
| `src/pages/` | The 9 pages |

### Pages

1. **Dashboard**: today's tiles (workouts, active minutes, gross and net kcal, reconciled steps, weight and trend); filters for category, exercise and date range; weekly or monthly charts for calories, active time, strength volume, cardio distance, daily steps and body weight; 26-week heatmap; week-vs-week and month-vs-month comparison; personal records.
2. **Log Workout**: live timer with Rest / Waiting / Pause / Resume / Stop, a timer per set, and a rest countdown. Six separate buckets: session, active, rest, waiting, paused, untracked. Also: log past workouts, templates, quick-add, prefill from the last session, "Use last time", add/duplicate/delete sets, a live calorie estimate with an expandable explanation, validation, duplicate warning, save-as-template. The in-progress workout is saved continuously.
3. **Exercise Library**: all 32 seeded exercises, plus custom ones. Each shows its historical records with type badges and a confirmed/unconfirmed toggle, the shin-pain warning where it applies, its MET table and calorie model, recent sessions and PRs.
4. **Workout History**: search, status and category filters; expandable sessions with the time breakdown and the calorie explanation for each exercise; edit, delete, and "Recalculate all".
5. **Strength Progress**: e1RM, heaviest set, volume and reps over time; machine filter, since stack weights differ between machines; historical records listed separately, not plotted.
6. **Cardio Analytics**: per-activity weekly minutes, distance, pace, speed and steps, plus a session table.
7. **Body Measurements**: dated entries for weight, waist, neck, hip, body fat and resting HR; weight and waist charts; Navy body-fat estimate when the inputs exist; a daily-activity log (steps, sleep, wearable totals).
8. **Goals**: weight-loss, weight-target, steps, exercise-calorie, strength and custom goals, with progress bars and deadlines.
9. **Settings & Profile**: every profile field, limitations editor, metric/imperial, gross/net display, rest timer, inferred seconds per rep, quick-add list, export/import (JSON, CSV), recalculation, reset.

### Calorie engine: methods, in priority order

1. **Manual** value, always labelled as manual.
2. **Cycling power**: work in kJ ÷ 24% efficiency ÷ 4.184. High confidence.
3. **ACSM running and walking equations**: speed and grade (treadmill incline or average grade from elevation gain), plus any carried load. Medium confidence.
4. **Keytel (2005) heart-rate equation**: cardio only, when average HR, age and sex are known. Medium confidence.
5. **MET**: `MET × 3.5 × kg ÷ 200 × active min`. Net uses `(MET − 1)`. Jump-rope intensity comes from cadence; outdoor cycling uses speed bands. Low confidence unless cadence or speed refine it.

Every estimate stores its formula version, all inputs, the measured inputs, assumptions, warnings and a heuristic low–high band (explicitly *not* a statistical confidence interval). Missing weight or duration gives "insufficient data" instead of a guess. For strength, untimed sets infer their time from reps (3 s per rep by default, configurable), are flagged as inferred, and get a wider band. Training volume never affects calories.

### Time accounting rules

- Only the timer can have one interval open at a time, so time is never counted twice.
- Active time comes only from timed or entered set/cardio durations, or from completed HIIT work intervals.
- Rest, waiting, paused and untracked time are separate. The session's total length is never treated as active time.
- A duration you correct by hand (`activeSource: manual`) is never overwritten by the timer.

### Double-counting safeguards

- Workout steps carry an "already in daily total" flag; reconciliation adds them only when they're not already included.
- Wearable daily calories are stored and shown separately and never added to exercise calories.
- Saving a session with the same date, the same exercises and a start time within 30 minutes (or the same external ID) asks for confirmation.
- Historical step aggregates (83,502 steps over 6 days; ~4M over 14 months) stay as records and aren't spread across days.

### Seeded data

- **Profile**: age 24 as of 2026-10-14 (advances yearly; date of birth not set), male, 170 cm, shin-pain limitation for running. All other fields empty.
- **Weights**: 83.2 kg (2026-10-06), 84.5 kg (09-23), 87 kg (09-01), plus three approximate ranges (Jan, Feb–Mar, Jun) with the ranges and date precision preserved.
- **Library**: 32 exercises across cardio, bodyweight/conditioning and barbell/dumbbell/machine, including the separate dumbbell variations and the horizontal machine row.
- **45 historical records**, each typed as estimated max / historical set / planned load / session report / mention / aggregate / old calorie estimate. All are unconfirmed, with per-dumbbell vs total load and ranges kept.
- **5 imported undated sessions** (status `imported-incomplete`, with clarifying questions):
  - 3 km in 27 min
  - 1 km in 6 min on the treadmill
  - 4 km in two sets (no durations, so no estimate)
  - walk: 7,845 steps in 74 min
  - ~1 h gym session: 7 exercises, ranges preserved, the hour not counted as active

### Verification done

- `tsc -b` is clean in strict mode.
- **89 tests pass**:
  - calorie formulas and method selection
  - time accounting and the timer state machine
  - strength math, step reconciliation, PRs
  - duplicates and validation, body/age/trend
  - seed acceptance checks, JSON/CSV import and export
  - UI tests: every page renders, a full workout is logged, a reload keeps the data, the gross/net switch works, the clarification prompt appears, the shin warning appears, corrupt storage is handled
- Production build checked in headless Chrome at 1440 px and 390 px on every page: no console errors and no horizontal page overflow. A live timer run recorded 2 s active, with the rest and waiting periods kept separate.

### Fixes made along the way

- Jogging MET intensities were in the wrong order. Fixed.
- HIIT active time now uses completed work intervals consistently in both the calorie engine and the time summary.
- Mobile horizontal overflow (grid children not shrinking; fixed-width filters). Fixed.
- Missing favicon causing a 404. Fixed.
- Vitest 2 bundled Vite 5, which clashed with Vite 6. Upgraded to Vitest 3.
- Node 25's built-in `localStorage` broke jsdom tests. Tests now install an in-memory Storage.

### Known limitations / next ideas

- MET values are transcribed from the 2011 Compendium and should be checked against the 2024 Adult Compendium. Bump `CALORIE_FORMULA_VERSION` after any change.
- Data lives in one browser only. Export backups regularly; cloud sync would need auth.
- No wearable import yet (the data model has `externalId` and `source: 'wearable'` ready).
- The imported sessions have no dates. Add them from History → edit to include them in the charts.
