import type { WorkoutPreset } from '@/types/workout';
import {
  addWorkoutSetToExercise,
  buildPresetSessionCreateRequestFromDraft,
  completeCurrentWorkoutSet,
  createWorkoutPlaybackDraftFromPreset,
  createWorkoutPlaybackRouteState,
  getCurrentWorkoutSetPointer,
  getWorkoutPlaybackStats,
  removeWorkoutSetFromExercise,
  toggleWorkoutSetCompletion,
  updateWorkoutSetAtPointer,
} from '@/utils/workoutPlayback';

const createPresetFixture = (): WorkoutPreset =>
  ({
    id: 'preset-1',
    user_id: 'user-1',
    name: 'Upper Body',
    description: 'Push + Pull',
    exercises: [
      {
        exercise_id: 'exercise-1',
        exercise_name: 'Bench Press',
        sets: [
          { set_number: 1, reps: 8, weight: 80, rest_time: 90 },
          { set_number: 2, reps: 8, weight: 80, rest_time: 90 },
        ],
      },
      {
        exercise_id: 'exercise-2',
        exercise_name: 'Barbell Row',
        sets: [{ set_number: 1, reps: 10, weight: 60, rest_time: 90 }],
      },
    ],
  }) as unknown as WorkoutPreset;

describe('workoutPlayback utils', () => {
  it('creates a local draft from a workout preset', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    expect(draft.name).toBe('Upper Body');
    expect(draft.entry_date).toBe('2026-04-27');
    expect(draft.exercises).toHaveLength(2);
    expect(draft.exercises[0]?.sets).toHaveLength(2);
    expect(
      draft.exercises
        .flatMap((exercise) => exercise.sets)
        .every((set) => !set.completed)
    ).toBe(true);
  });

  it('builds a route state that carries the draft and return path', () => {
    const routeState = createWorkoutPlaybackRouteState(
      createPresetFixture(),
      '2026-04-27',
      '/diary'
    );

    expect(routeState.returnTo).toBe('/diary');
    expect(routeState.draft?.entry_date).toBe('2026-04-27');
    expect(routeState.draft?.name).toBe('Upper Body');
  });

  it('marks the current set complete and advances the active pointer', () => {
    const initialDraft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    const nextDraft = completeCurrentWorkoutSet(initialDraft);
    const pointer = getCurrentWorkoutSetPointer(nextDraft);
    const stats = getWorkoutPlaybackStats(nextDraft);

    expect(nextDraft.exercises[0]?.sets[0]?.completed).toBe(true);
    expect(pointer).toEqual({ exerciseIndex: 0, setIndex: 1 });
    expect(stats.completedSets).toBe(1);
    expect(stats.totalSets).toBe(3);
  });

  it('builds grouped-session payload from completed sets only', () => {
    const initialDraft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    let nextDraft = toggleWorkoutSetCompletion(initialDraft, {
      exerciseIndex: 0,
      setIndex: 0,
    });
    nextDraft = toggleWorkoutSetCompletion(nextDraft, {
      exerciseIndex: 1,
      setIndex: 0,
    });

    const payload = buildPresetSessionCreateRequestFromDraft(nextDraft);

    expect(payload.name).toBe('Upper Body');
    expect(payload.source).toBe('sparky');
    expect(payload.exercises).toHaveLength(2);
    expect(payload.exercises?.[0]?.sets).toHaveLength(1);
    expect(payload.exercises?.[0]?.sets?.[0]?.set_number).toBe(1);
    expect(payload.exercises?.[1]?.sets).toHaveLength(1);
  });

  it('updates set fields and supports add/remove set editing', () => {
    const initialDraft = createWorkoutPlaybackDraftFromPreset(
      createPresetFixture(),
      '2026-04-27'
    );

    let nextDraft = updateWorkoutSetAtPointer(
      initialDraft,
      { exerciseIndex: 0, setIndex: 0 },
      { reps: 12, weight: 85 }
    );
    nextDraft = addWorkoutSetToExercise(nextDraft, 0);

    expect(nextDraft.exercises[0]?.sets).toHaveLength(3);
    expect(nextDraft.exercises[0]?.sets[0]?.reps).toBe(12);
    expect(nextDraft.exercises[0]?.sets[0]?.weight).toBe(85);

    nextDraft = removeWorkoutSetFromExercise(nextDraft, {
      exerciseIndex: 0,
      setIndex: 2,
    });
    expect(nextDraft.exercises[0]?.sets).toHaveLength(2);
  });
});
