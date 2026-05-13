import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader } from '@/components/ui/card';
import { useCreatePresetSessionMutation } from '@/hooks/Exercises/useExerciseEntries';
import {
  DEFAULT_REST_SECONDS,
  addWorkoutSetToExercise,
  buildPresetSessionCreateRequestFromDraft,
  completeCurrentWorkoutSet,
  getCurrentWorkoutSetPointer,
  getWorkoutPlaybackStats,
  isWorkoutPlaybackComplete,
  removeWorkoutSetFromExercise,
  setWorkoutPlaybackPointer,
  setWorkoutPlaybackRestTimer,
  toggleWorkoutSetCompletion,
  type WorkoutPlaybackRouteState,
  type WorkoutPlaybackDraft,
  type WorkoutSetPointer,
  updateWorkoutSetAtPointer,
} from '@/utils/workoutPlayback';
import WorkoutPlaybackDialogs from './WorkoutPlaybackDialogs';
import WorkoutPlaybackExercisesList from './WorkoutPlaybackExercisesList';
import WorkoutPlaybackSummary from './WorkoutPlaybackSummary';

const MIN_REST_SECONDS = 15;
const MAX_REST_SECONDS = 900;

function formatDurationClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function clampRestSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return DEFAULT_REST_SECONDS;
  }

  const clamped = Math.max(
    MIN_REST_SECONDS,
    Math.min(MAX_REST_SECONDS, seconds)
  );
  return Math.round(clamped / 5) * 5;
}

function getInitialDraft(
  requestedDate: string | null,
  routeState: WorkoutPlaybackRouteState | null
): WorkoutPlaybackDraft | null {
  const existingDraft = routeState?.draft ?? null;
  if (!existingDraft) {
    return null;
  }

  if (requestedDate && existingDraft.entry_date !== requestedDate) {
    return null;
  }

  return existingDraft;
}

function getReturnPath(
  requestedDate: string | null,
  routeState: WorkoutPlaybackRouteState | null
): string {
  if (routeState?.returnTo) {
    return routeState.returnTo;
  }

  if (requestedDate) {
    return `/?date=${requestedDate}`;
  }

  return '/';
}

function startRestTimer(
  draft: WorkoutPlaybackDraft,
  restSeconds: number,
  targetPointer?: WorkoutSetPointer
): WorkoutPlaybackDraft {
  const normalizedRestSeconds = Math.max(0, restSeconds);

  if (normalizedRestSeconds === 0) {
    return setWorkoutPlaybackRestTimer(draft, {
      state: 'idle',
      duration_seconds: 0,
      remaining_seconds: 0,
      target_exercise_index: undefined,
      target_set_index: undefined,
    });
  }

  return setWorkoutPlaybackRestTimer(draft, {
    state: 'running',
    duration_seconds: normalizedRestSeconds,
    remaining_seconds: normalizedRestSeconds,
    target_exercise_index: targetPointer?.exerciseIndex,
    target_set_index: targetPointer?.setIndex,
  });
}

const WorkoutPlaybackPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedDate = searchParams.get('date');
  const routeState =
    (location.state as WorkoutPlaybackRouteState | null) ?? null;
  const returnPath = getReturnPath(requestedDate, routeState);

  const scrubbedRouteStateRef = useRef(false);
  const [draft, setDraft] = useState<WorkoutPlaybackDraft | null>(() =>
    getInitialDraft(requestedDate, routeState)
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [elapsedTickMs, setElapsedTickMs] = useState(() => Date.now());
  const [setNotesVisibility, setSetNotesVisibility] = useState<
    Record<string, boolean>
  >({});
  const [restEditorPointer, setRestEditorPointer] =
    useState<WorkoutSetPointer | null>(null);
  const [restEditorCustomValue, setRestEditorCustomValue] = useState('');
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

  const { mutateAsync: createPresetSession, isPending: isSaving } =
    useCreatePresetSessionMutation();

  useEffect(() => {
    if (scrubbedRouteStateRef.current || !routeState?.draft) {
      return;
    }

    scrubbedRouteStateRef.current = true;
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: routeState.returnTo
        ? { returnTo: routeState.returnTo }
        : undefined,
    });
  }, [
    location.pathname,
    location.search,
    navigate,
    routeState,
    routeState?.draft,
    routeState?.returnTo,
  ]);

  // Combined interval for both rest timer and elapsed time
  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedTickMs(Date.now());

      setDraft((currentDraft) => {
        if (!currentDraft || currentDraft.rest_timer.state !== 'running') {
          return currentDraft;
        }

        const nextRemaining = Math.max(
          0,
          currentDraft.rest_timer.remaining_seconds - 1
        );

        return setWorkoutPlaybackRestTimer(currentDraft, {
          ...currentDraft.rest_timer,
          state: nextRemaining === 0 ? 'idle' : 'running',
          remaining_seconds: nextRemaining,
        });
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    if (!draft) return null;
    return getWorkoutPlaybackStats(draft);
  }, [draft]);

  const totalExercises = draft?.exercises.length ?? 0;

  const totalWeight = useMemo(() => {
    if (!draft) return 0;

    return draft.exercises.reduce(
      (exerciseSum, exercise) =>
        exerciseSum +
        exercise.sets.reduce(
          (setSum, set) => setSum + (Number(set.weight) || 0),
          0
        ),
      0
    );
  }, [draft]);

  const elapsedSeconds = useMemo(() => {
    if (!draft) return 0;
    const startedAtMs = Date.parse(draft.started_at);
    if (Number.isNaN(startedAtMs)) {
      return 0;
    }
    return Math.max(0, Math.floor((elapsedTickMs - startedAtMs) / 1000));
  }, [draft, elapsedTickMs]);

  const updateDraft = (
    updater: (currentDraft: WorkoutPlaybackDraft) => WorkoutPlaybackDraft
  ) => {
    setDraft((currentDraft) => {
      if (!currentDraft) return currentDraft;
      return updater(currentDraft);
    });
  };

  const handleCompleteSet = (pointer: WorkoutSetPointer) => {
    updateDraft((currentDraft) => {
      const set =
        currentDraft.exercises[pointer.exerciseIndex]?.sets[pointer.setIndex];
      if (!set || set.completed) {
        return currentDraft;
      }

      let nextDraft = setWorkoutPlaybackPointer(currentDraft, pointer);
      nextDraft = completeCurrentWorkoutSet(nextDraft);

      if (!isWorkoutPlaybackComplete(nextDraft)) {
        const restSeconds = set.rest_time ?? DEFAULT_REST_SECONDS;
        const targetPointer = getCurrentWorkoutSetPointer(nextDraft);
        nextDraft = startRestTimer(nextDraft, restSeconds, targetPointer);
      }

      return nextDraft;
    });
  };

  const handleUncompleteSet = (pointer: WorkoutSetPointer) => {
    updateDraft((currentDraft) => {
      const updated = toggleWorkoutSetCompletion(
        setWorkoutPlaybackPointer(currentDraft, pointer),
        pointer
      );

      // If rest timer was targeting the now-uncompleted set, reset it
      if (
        updated.rest_timer.target_exercise_index === pointer.exerciseIndex &&
        updated.rest_timer.target_set_index === pointer.setIndex &&
        updated.rest_timer.state !== 'idle'
      ) {
        return setWorkoutPlaybackRestTimer(updated, {
          ...updated.rest_timer,
          state: 'idle',
          remaining_seconds: 0,
        });
      }

      return updated;
    });
  };

  const handleSetFieldChange = (
    pointer: WorkoutSetPointer,
    field: 'reps' | 'weight' | 'rest_time' | 'set_type' | 'notes',
    value: number | string | null
  ) => {
    updateDraft((currentDraft) =>
      updateWorkoutSetAtPointer(currentDraft, pointer, { [field]: value })
    );
  };

  const handleSessionNotesChange = (value: string) => {
    updateDraft((currentDraft) => ({ ...currentDraft, notes: value }));
  };

  const toggleSetNotesVisibility = (setKey: string) => {
    setSetNotesVisibility((current) => ({
      ...current,
      [setKey]: !current[setKey],
    }));
  };

  const handleAddSet = (exerciseIndex: number) => {
    updateDraft((currentDraft) =>
      addWorkoutSetToExercise(currentDraft, exerciseIndex)
    );
  };

  const handleRemoveSet = (pointer: WorkoutSetPointer) => {
    updateDraft((currentDraft) =>
      removeWorkoutSetFromExercise(currentDraft, pointer)
    );
  };

  const handlePauseResumeRest = () => {
    updateDraft((currentDraft) => {
      if (currentDraft.rest_timer.state === 'running') {
        return setWorkoutPlaybackRestTimer(currentDraft, {
          ...currentDraft.rest_timer,
          state: 'paused',
        });
      }

      if (currentDraft.rest_timer.state === 'paused') {
        return setWorkoutPlaybackRestTimer(currentDraft, {
          ...currentDraft.rest_timer,
          state: 'running',
        });
      }

      return currentDraft;
    });
  };

  const handleSkipRest = () => {
    updateDraft((currentDraft) =>
      setWorkoutPlaybackRestTimer(currentDraft, {
        ...currentDraft.rest_timer,
        state: 'idle',
        remaining_seconds: currentDraft.rest_timer.duration_seconds,
        target_exercise_index: undefined,
        target_set_index: undefined,
      })
    );
  };

  const handleOpenRestEditor = (pointer: WorkoutSetPointer) => {
    if (!draft) return;
    const selectedSet =
      draft.exercises[pointer.exerciseIndex]?.sets[pointer.setIndex];
    if (!selectedSet) return;
    setRestEditorPointer(pointer);
    setRestEditorCustomValue(
      String(selectedSet.rest_time ?? DEFAULT_REST_SECONDS)
    );
  };

  const closeRestEditor = () => {
    setRestEditorPointer(null);
    setRestEditorCustomValue('');
  };

  const updateRestForPointer = (seconds: number) => {
    if (!restEditorPointer) return;
    const normalized = clampRestSeconds(seconds);
    updateDraft((currentDraft) =>
      updateWorkoutSetAtPointer(currentDraft, restEditorPointer, {
        rest_time: normalized,
      })
    );
    closeRestEditor();
  };

  const handleSaveCustomRest = () => {
    const parsed = Number(restEditorCustomValue);
    updateRestForPointer(
      Number.isFinite(parsed) ? parsed : DEFAULT_REST_SECONDS
    );
  };

  const handleSelectSet = (pointer: WorkoutSetPointer) => {
    updateDraft((currentDraft) =>
      setWorkoutPlaybackPointer(currentDraft, pointer)
    );
  };

  const handleCloseKeepDraft = () => {
    navigate(returnPath);
  };

  const handleDiscard = () => {
    setIsDiscardDialogOpen(true);
  };

  const handleConfirmDiscard = () => {
    setDraft(null);
    setSaveError(null);
    setIsDiscardDialogOpen(false);
    navigate(returnPath);
  };

  const handleFinishWorkout = async () => {
    if (!draft) return;

    const payload = buildPresetSessionCreateRequestFromDraft(draft);
    if (!payload.exercises || payload.exercises.length === 0) {
      setSaveError(
        t(
          'exercise.workoutPlaybackDialog.completeAtLeastOneSet',
          'Complete at least one set before finishing.'
        )
      );
      return;
    }

    try {
      await createPresetSession(payload);
      setDraft(null);
      setSaveError(null);
      navigate(returnPath, { replace: true });
    } catch {
      setSaveError(
        t(
          'exercise.workoutPlaybackDialog.finishError',
          'Failed to save workout. Your local progress is still preserved, and you can retry.'
        )
      );
    }
  };

  if (!draft) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Button
          type="button"
          variant="ghost"
          className="gap-2"
          onClick={() => navigate(returnPath)}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back', 'Back')}
        </Button>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">
              {t('exercise.workoutPlaybackDialog.title', 'Live Workout')}
            </h2>
            <CardDescription>
              {t(
                'exercise.workoutPlaybackDialog.noDraft',
                'No active workout draft was found for this date.'
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const restRemaining = formatDurationClock(
    draft?.rest_timer.remaining_seconds ?? 0
  );
  const isRestActive = draft && draft.rest_timer.state !== 'idle';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <WorkoutPlaybackSummary
        draft={draft}
        elapsedSeconds={elapsedSeconds}
        totalExercises={totalExercises}
        totalWeight={totalWeight}
        stats={stats}
        restRemaining={restRemaining}
        isRestActive={!!isRestActive}
        saveError={saveError}
        isSaving={isSaving}
        onCloseKeepDraft={handleCloseKeepDraft}
        onDiscard={handleDiscard}
        onFinishWorkout={handleFinishWorkout}
        onPauseResumeRest={handlePauseResumeRest}
        onSkipRest={handleSkipRest}
        onSessionNotesChange={handleSessionNotesChange}
      />

      <WorkoutPlaybackExercisesList
        draft={draft}
        setNotesVisibility={setNotesVisibility}
        onToggleSetNotesVisibility={toggleSetNotesVisibility}
        onSelectSet={handleSelectSet}
        onCompleteSet={handleCompleteSet}
        onUncompleteSet={handleUncompleteSet}
        onSetFieldChange={handleSetFieldChange}
        onOpenRestEditor={handleOpenRestEditor}
        onRemoveSet={handleRemoveSet}
        onAddSet={handleAddSet}
      />

      <WorkoutPlaybackDialogs
        restEditorPointer={restEditorPointer}
        restEditorCustomValue={restEditorCustomValue}
        onCloseRestEditor={closeRestEditor}
        onUpdateRestForPointer={updateRestForPointer}
        onSetRestEditorCustomValue={setRestEditorCustomValue}
        onSaveCustomRest={handleSaveCustomRest}
        isDiscardDialogOpen={isDiscardDialogOpen}
        onDiscardDialogChange={setIsDiscardDialogOpen}
        onConfirmDiscard={handleConfirmDiscard}
      />
    </div>
  );
};

export default WorkoutPlaybackPage;
