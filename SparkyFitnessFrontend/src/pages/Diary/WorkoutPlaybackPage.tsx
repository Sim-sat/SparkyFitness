import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Flag,
  Pause,
  Play,
  SkipForward,
  Timer,
  Trash2,
  MessageSquare,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreatePresetSessionMutation } from '@/hooks/Exercises/useExerciseEntries';
import { excerciseWorkoutSetTypes } from '@/constants/excerciseWorkoutSetTypes';
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

const REST_PRESETS = [30, 45, 60, 90, 120, 180, 300];
const MIN_REST_SECONDS = 15;
const MAX_REST_SECONDS = 900;

function formatDurationClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatRestChip(seconds: number | null | undefined): string {
  const value = seconds ?? DEFAULT_REST_SECONDS;
  if (value < 60) {
    return `${value}s`;
  }

  return formatDurationClock(value);
}

function formatWorkoutWeight(totalWeight: number): string {
  const rounded = Number(totalWeight.toFixed(1));
  return `${rounded}`;
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

function parseNullableNumber(raw: string): number | null {
  if (raw.trim() === '') {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          className="w-fit gap-2"
          onClick={handleCloseKeepDraft}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back', 'Back')}
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCloseKeepDraft}
          >
            <X className="mr-1 h-4 w-4" />
            {t('exercise.workoutPlaybackDialog.closeKeepDraft', 'Close')}
          </Button>
          <Button type="button" variant="outline" onClick={handleDiscard}>
            {t('exercise.workoutPlaybackDialog.discard', 'Discard')}
          </Button>
          <Button
            type="button"
            onClick={handleFinishWorkout}
            disabled={isSaving}
          >
            <Flag className="mr-1 h-4 w-4" />
            {isSaving
              ? t('exercise.workoutPlaybackDialog.finishing', 'Saving...')
              : t('exercise.workoutPlaybackDialog.finish', 'Finish Workout')}
          </Button>
        </div>
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="space-y-1 px-0 pb-2 pt-0">
          <h1 className="text-sm font-semibold leading-tight">{draft.name}</h1>
          <CardDescription className="text-[11px] leading-tight">
            {t(
              'exercise.workoutPlaybackPage.description',
              'Track your sets live, follow rest countdowns, and save when you finish.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 px-0 pt-0">
          <div className="grid w-full grid-cols-5 divide-x divide-border overflow-hidden rounded-sm border border-border/60 bg-background text-center">
            <div className="flex min-w-0 flex-col items-center justify-center px-1 py-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('exercise.workoutPlaybackPage.elapsedTime', 'Duration')}
              </span>
              <span className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                {formatDurationClock(elapsedSeconds)}
              </span>
            </div>
            <div className="flex min-w-0 flex-col items-center justify-center px-1 py-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('exercise.workoutPlaybackPage.exercises', 'Exercises')}
              </span>
              <span className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                {totalExercises}
              </span>
            </div>
            <div className="flex min-w-0 flex-col items-center justify-center px-1 py-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('exercise.workoutPlaybackPage.weight', 'Weight')}
              </span>
              <span className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                {formatWorkoutWeight(totalWeight)}
              </span>
            </div>
            <div className="flex min-w-0 flex-col items-center justify-center px-1 py-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('exercise.workoutPlaybackPage.progress', 'Sets')}
              </span>
              <span className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                {stats?.completedSets ?? 0}/{stats?.totalSets ?? 0}
              </span>
            </div>
            <div className="flex min-w-0 flex-col items-center justify-center px-1 py-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('exercise.workoutPlaybackPage.restTimer', 'Rest')}
              </span>
              <span className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                {draft.rest_timer.state === 'idle' ? '0:00' : restRemaining}
              </span>
              {isRestActive && (
                <div className="mt-1 flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    aria-label={
                      draft.rest_timer.state === 'running'
                        ? t('common.pause', 'Pause')
                        : t('common.resume', 'Resume')
                    }
                    onClick={handlePauseResumeRest}
                  >
                    {draft.rest_timer.state === 'running' ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    aria-label={t('common.skip', 'Skip')}
                    onClick={handleSkipRest}
                  >
                    <SkipForward className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t('exercise.logExerciseEntryDialog.sessionNotes', 'Notes')}
            </label>
            <Textarea
              value={draft.notes ?? ''}
              rows={2}
              className="resize-none text-sm"
              placeholder={t(
                'exercise.logExerciseEntryDialog.notesPlaceholder',
                'Any notes about this session...'
              )}
              onChange={(event) => handleSessionNotesChange(event.target.value)}
            />
          </div>

          {saveError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {draft.exercises.map((exercise, exerciseIndex) => {
          const completedSets = exercise.sets.filter(
            (set) => set.completed
          ).length;
          const totalSets = exercise.sets.length;
          const isComplete = totalSets > 0 && completedSets === totalSets;
          const exerciseKey = `${exercise.exercise_id}-${exerciseIndex}`;
          const isExpanded = !isComplete;

          return (
            <Card
              key={`${exercise.exercise_id}-${exerciseIndex}`}
              className="shadow-none border-border/70"
            >
              <CardHeader className="py-2 px-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">
                      {exercise.exercise_name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {completedSets}/{totalSets}{' '}
                      {t('exercise.workoutPlaybackDialog.sets', 'sets')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ChevronDown
                      className={`h-4 w-4 ${
                        isComplete ? 'text-emerald-500' : 'rotate-180'
                      }`}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {isComplete
                        ? t(
                            'exercise.workoutPlaybackPage.completed',
                            'Completed'
                          )
                        : t(
                            'exercise.workoutPlaybackPage.inProgress',
                            'In Progress'
                          )}
                    </span>
                  </div>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="pt-0 pb-2 px-3">
                  <div className="space-y-1">
                    <div className="hidden sm:block overflow-x-auto pb-1">
                      <div className="flex items-center gap-2 min-w-[640px] text-[10px] font-medium text-muted-foreground">
                        <div className="w-44">
                          {t('exercise.workoutPlaybackPage.columnSet', 'Set')}
                        </div>
                        <div className="w-44">
                          {t('exercise.workoutPlaybackPage.columnType', 'Type')}
                        </div>
                        <div className="w-24">
                          {t('exercise.workoutPlaybackPage.columnReps', 'Reps')}
                        </div>
                        <div className="w-28">
                          {t(
                            'exercise.workoutPlaybackPage.columnWeight',
                            'Weight'
                          )}
                        </div>
                        <div className="w-32">
                          {t('exercise.workoutPlaybackPage.columnRest', 'Rest')}
                        </div>
                        <div className="w-20 text-right">
                          {t('common.actions', 'Actions')}
                        </div>
                      </div>
                    </div>
                    {exercise.sets.map((set, setIndex) => {
                      const pointer: WorkoutSetPointer = {
                        exerciseIndex,
                        setIndex,
                      };
                      return (
                        <div
                          key={`${exercise.exercise_id}-${exerciseIndex}-${setIndex}`}
                        >
                          {/* Set card - no role="button" to avoid a11y violations */}
                          <div
                            className={`w-full rounded-sm border px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 ${
                              set.completed
                                ? 'border-border/60 bg-muted/40 text-muted-foreground'
                                : 'border-border/70 bg-background'
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2 md:hidden">
                                  <div
                                    className="flex cursor-pointer items-center gap-2 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                    aria-label={`Select set ${set.set_number} for ${exercise.exercise_name}`}
                                    onClick={() => {
                                      updateDraft((currentDraft) =>
                                        setWorkoutPlaybackPointer(
                                          currentDraft,
                                          pointer
                                        )
                                      );
                                    }}
                                    onKeyDown={(event) => {
                                      if (
                                        event.key === 'Enter' ||
                                        event.key === ' '
                                      ) {
                                        event.preventDefault();
                                        updateDraft((currentDraft) =>
                                          setWorkoutPlaybackPointer(
                                            currentDraft,
                                            pointer
                                          )
                                        );
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                  >
                                    <Checkbox
                                      aria-label={`Complete set ${set.set_number}`}
                                      checked={set.completed}
                                      className="data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                      }}
                                      onCheckedChange={(checked) => {
                                        if (checked === true) {
                                          handleCompleteSet(pointer);
                                        } else {
                                          handleUncompleteSet(pointer);
                                        }
                                      }}
                                    />
                                    <span className="text-sm font-medium">
                                      {t(
                                        'exercise.workoutPlaybackDialog.setRow',
                                        'Set {{setNumber}}',
                                        { setNumber: set.set_number }
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="cursor-pointer"
                                      aria-label={`Toggle notes for set ${set.set_number}`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        toggleSetNotesVisibility(
                                          `${exerciseKey}-${setIndex}`
                                        );
                                      }}
                                    >
                                      <MessageSquare className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="cursor-pointer"
                                      disabled={exercise.sets.length <= 1}
                                      aria-label={`Remove set ${set.set_number} for ${exercise.exercise_name}`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleRemoveSet(pointer);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 md:hidden">
                                  <div className="col-span-2">
                                    <Select
                                      value={set.set_type ?? 'Working Set'}
                                      onValueChange={(value) =>
                                        handleSetFieldChange(
                                          pointer,
                                          'set_type',
                                          value
                                        )
                                      }
                                    >
                                      <SelectTrigger
                                        aria-label={`Type set ${set.set_number}`}
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                        className="!border-border/70 !bg-transparent !shadow-none !outline-none !ring-0 focus:!border-border/70 focus:!outline-none focus:!ring-0 focus-visible:!border-border/70 focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 data-[state=open]:!border-border/70 data-[state=open]:!outline-none data-[state=open]:!ring-0 data-[state=open]:!shadow-none"
                                        style={{
                                          boxShadow: 'none',
                                          outline: 'none',
                                        }}
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {excerciseWorkoutSetTypes.map(
                                          (type) => (
                                            <SelectItem key={type} value={type}>
                                              {t(
                                                `workout.setType.${type}`,
                                                type
                                              )}
                                            </SelectItem>
                                          )
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    step={1}
                                    aria-label={`Reps set ${set.set_number}`}
                                    value={set.reps ?? ''}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) =>
                                      handleSetFieldChange(
                                        pointer,
                                        'reps',
                                        parseNullableNumber(event.target.value)
                                      )
                                    }
                                    placeholder={t('common.reps', 'reps')}
                                    className="focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                  />
                                  <Input
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step={0.5}
                                    aria-label={`Weight set ${set.set_number}`}
                                    value={set.weight ?? ''}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) =>
                                      handleSetFieldChange(
                                        pointer,
                                        'weight',
                                        parseNullableNumber(event.target.value)
                                      )
                                    }
                                    placeholder={t('common.weight', 'Weight')}
                                    className="focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                  />
                                  <div className="col-span-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="w-full justify-start px-2 tabular-nums"
                                      aria-label={`Edit rest for set ${set.set_number}`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleOpenRestEditor(pointer);
                                      }}
                                    >
                                      <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                                      {t(
                                        'exercise.workoutPlaybackPage.restChipLabel',
                                        'Rest · {{time}}',
                                        { time: formatRestChip(set.rest_time) }
                                      )}
                                    </Button>
                                  </div>
                                </div>

                                <div className="hidden overflow-x-auto md:block">
                                  <div className="flex items-center gap-2 min-w-[600px]">
                                    <div
                                      className="w-44 flex cursor-pointer items-center gap-2 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                      aria-label={`Select set ${set.set_number} for ${exercise.exercise_name}`}
                                      onClick={() => {
                                        updateDraft((currentDraft) =>
                                          setWorkoutPlaybackPointer(
                                            currentDraft,
                                            pointer
                                          )
                                        );
                                      }}
                                      onKeyDown={(event) => {
                                        if (
                                          event.key === 'Enter' ||
                                          event.key === ' '
                                        ) {
                                          event.preventDefault();
                                          updateDraft((currentDraft) =>
                                            setWorkoutPlaybackPointer(
                                              currentDraft,
                                              pointer
                                            )
                                          );
                                        }
                                      }}
                                      role="button"
                                      tabIndex={0}
                                    >
                                      <Checkbox
                                        aria-label={`Complete set ${set.set_number}`}
                                        checked={set.completed}
                                        className="data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                        }}
                                        onCheckedChange={(checked) => {
                                          if (checked === true) {
                                            handleCompleteSet(pointer);
                                          } else {
                                            handleUncompleteSet(pointer);
                                          }
                                        }}
                                      />
                                      <span className="text-sm font-medium">
                                        {t(
                                          'exercise.workoutPlaybackDialog.setRow',
                                          'Set {{setNumber}}',
                                          { setNumber: set.set_number }
                                        )}
                                      </span>
                                    </div>

                                    <div className="w-44">
                                      <Select
                                        value={set.set_type ?? 'Working Set'}
                                        onValueChange={(value) =>
                                          handleSetFieldChange(
                                            pointer,
                                            'set_type',
                                            value
                                          )
                                        }
                                      >
                                        <SelectTrigger
                                          aria-label={`Type set ${set.set_number}`}
                                          onClick={(event) =>
                                            event.stopPropagation()
                                          }
                                          className="!border-border/70 !bg-transparent !shadow-none !outline-none !ring-0 focus:!border-border/70 focus:!outline-none focus:!ring-0 focus-visible:!border-border/70 focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 data-[state=open]:!border-border/70 data-[state=open]:!outline-none data-[state=open]:!ring-0 data-[state=open]:!shadow-none"
                                          style={{
                                            boxShadow: 'none',
                                            outline: 'none',
                                          }}
                                        >
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {excerciseWorkoutSetTypes.map(
                                            (type) => (
                                              <SelectItem
                                                key={type}
                                                value={type}
                                              >
                                                {t(
                                                  `workout.setType.${type}`,
                                                  type
                                                )}
                                              </SelectItem>
                                            )
                                          )}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="w-24">
                                      <Input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        step={1}
                                        aria-label={`Reps set ${set.set_number}`}
                                        value={set.reps ?? ''}
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                        onChange={(event) =>
                                          handleSetFieldChange(
                                            pointer,
                                            'reps',
                                            parseNullableNumber(
                                              event.target.value
                                            )
                                          )
                                        }
                                        placeholder={t('common.reps', 'reps')}
                                        className="focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                      />
                                    </div>

                                    <div className="w-28">
                                      <Input
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        step={0.5}
                                        aria-label={`Weight set ${set.set_number}`}
                                        value={set.weight ?? ''}
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                        onChange={(event) =>
                                          handleSetFieldChange(
                                            pointer,
                                            'weight',
                                            parseNullableNumber(
                                              event.target.value
                                            )
                                          )
                                        }
                                        placeholder={t(
                                          'common.weight',
                                          'Weight'
                                        )}
                                        className="focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                      />
                                    </div>

                                    <div className="w-32">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full justify-start px-2 tabular-nums"
                                        aria-label={`Edit rest for set ${set.set_number}`}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleOpenRestEditor(pointer);
                                        }}
                                      >
                                        <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t(
                                          'exercise.workoutPlaybackPage.restChipLabel',
                                          'Rest · {{time}}',
                                          {
                                            time: formatRestChip(set.rest_time),
                                          }
                                        )}
                                      </Button>
                                    </div>

                                    <div className="w-32 flex items-center justify-end gap-0.5">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="cursor-pointer"
                                        aria-label={`Toggle notes for set ${set.set_number}`}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          toggleSetNotesVisibility(
                                            `${exerciseKey}-${setIndex}`
                                          );
                                        }}
                                      >
                                        <MessageSquare className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="cursor-pointer"
                                        disabled={exercise.sets.length <= 1}
                                        aria-label={`Remove set ${set.set_number} for ${exercise.exercise_name}`}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleRemoveSet(pointer);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {setNotesVisibility[
                                `${exerciseKey}-${setIndex}`
                              ] && (
                                <Input
                                  aria-label={`Set notes ${set.set_number}`}
                                  value={set.notes ?? ''}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) =>
                                    handleSetFieldChange(
                                      pointer,
                                      'notes',
                                      event.target.value
                                    )
                                  }
                                  placeholder={t(
                                    'workout.notesPlaceholder',
                                    'Add a note for this set...'
                                  )}
                                  className="focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none text-sm"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {isExpanded && (
                    <div className="pt-1 flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-0 text-xs text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
                        onClick={() => handleAddSet(exerciseIndex)}
                        aria-label={`Add set for ${exercise.exercise_name}`}
                      >
                        Add Set
                      </Button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog
        open={!!restEditorPointer}
        onOpenChange={(open) => !open && closeRestEditor()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('exercise.workoutPlaybackPage.restEditorTitle', 'Edit Rest')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'exercise.workoutPlaybackPage.restEditorDescription',
                'Pick a rest duration for this set.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {REST_PRESETS.map((seconds) => (
                <Button
                  key={seconds}
                  type="button"
                  variant="outline"
                  className="tabular-nums"
                  onClick={() => updateRestForPointer(seconds)}
                >
                  {formatDurationClock(seconds)}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="custom-rest-seconds"
              >
                {t(
                  'exercise.workoutPlaybackPage.customRest',
                  'Custom (seconds)'
                )}
              </label>
              <Input
                id="custom-rest-seconds"
                type="number"
                min={MIN_REST_SECONDS}
                max={MAX_REST_SECONDS}
                step={5}
                value={restEditorCustomValue}
                onChange={(event) =>
                  setRestEditorCustomValue(event.target.value)
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeRestEditor}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="button" onClick={handleSaveCustomRest}>
                {t('common.save', 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={isDiscardDialogOpen}
        onOpenChange={setIsDiscardDialogOpen}
        onConfirm={handleConfirmDiscard}
        title={t('exercise.workoutPlaybackDialog.discard', 'Discard')}
        description={t(
          'exercise.workoutPlaybackDialog.discardConfirm',
          'Discard this in-progress workout? This cannot be undone.'
        )}
        variant="destructive"
        confirmLabel={t('exercise.workoutPlaybackDialog.discard', 'Discard')}
      />
    </div>
  );
};

export default WorkoutPlaybackPage;
