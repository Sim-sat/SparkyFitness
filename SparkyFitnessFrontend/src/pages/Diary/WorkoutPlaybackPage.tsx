import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Flag,
  Pause,
  Play,
  Plus,
  SkipForward,
  Timer,
  Trash2,
  MessageSquare,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
  clearWorkoutPlaybackDraft,
  completeCurrentWorkoutSet,
  getCurrentWorkoutSetPointer,
  getWorkoutPlaybackStats,
  isWorkoutPlaybackComplete,
  loadWorkoutPlaybackDraft,
  removeWorkoutSetFromExercise,
  saveWorkoutPlaybackDraft,
  setWorkoutPlaybackPointer,
  setWorkoutPlaybackRestTimer,
  toggleWorkoutSetCompletion,
  type WorkoutPlaybackDraft,
  type WorkoutSetPointer,
  updateWorkoutSetAtPointer,
} from '@/utils/workoutPlayback';

interface WorkoutPlaybackRouteState {
  returnTo?: string;
}

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
  requestedDate: string | null
): WorkoutPlaybackDraft | null {
  const existingDraft = loadWorkoutPlaybackDraft();
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

  const [draft, setDraft] = useState<WorkoutPlaybackDraft | null>(() =>
    getInitialDraft(requestedDate)
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [elapsedTickMs, setElapsedTickMs] = useState(() => Date.now());
  const [exerciseVisibility, setExerciseVisibility] = useState<
    Record<string, boolean>
  >({});
  const [setNotesVisibility, setSetNotesVisibility] = useState<
    Record<string, boolean>
  >({});
  const [restEditorPointer, setRestEditorPointer] =
    useState<WorkoutSetPointer | null>(null);
  const [restEditorCustomValue, setRestEditorCustomValue] = useState('');

  const { mutateAsync: createPresetSession, isPending: isSaving } =
    useCreatePresetSessionMutation();

  // Memoize the payload state for debounced save
  const draftForSave = useMemo(
    () => ({
      exercises: draft?.exercises,
      notes: draft?.notes,
      restState: draft?.rest_timer.state,
    }),
    [draft?.exercises, draft?.notes, draft?.rest_timer.state]
  );

  // Debounced save to localStorage - only on meaningful changes, not timer ticks
  useEffect(() => {
    if (!draft) {
      return;
    }

    const timer = setTimeout(() => {
      saveWorkoutPlaybackDraft(draft);
    }, 500);

    return () => clearTimeout(timer);
  }, [draftForSave, draft]);

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

  const currentPointer = useMemo(() => {
    if (!draft) return null;
    return getCurrentWorkoutSetPointer(draft);
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

  const toggleExerciseVisibility = (exerciseKey: string, open: boolean) => {
    setExerciseVisibility((current) => ({ ...current, [exerciseKey]: open }));
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
    const shouldDiscard = window.confirm(
      t(
        'exercise.workoutPlaybackDialog.discardConfirm',
        'Discard this in-progress workout? This cannot be undone.'
      )
    );

    if (!shouldDiscard) {
      return;
    }

    clearWorkoutPlaybackDraft();
    setDraft(null);
    setSaveError(null);
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
      clearWorkoutPlaybackDraft();
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

      <Card>
        <CardHeader className="space-y-2">
          <div>
            <h1 className="text-2xl font-bold">{draft.name}</h1>
            <CardDescription>
              {t(
                'exercise.workoutPlaybackPage.description',
                'Track your sets live, follow rest countdowns, and save when you finish.'
              )}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">
                {t('exercise.workoutPlaybackPage.elapsedTime', 'Elapsed Time')}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums">
                <Timer className="h-4 w-4 text-muted-foreground" />
                {formatDurationClock(elapsedSeconds)}
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">
                {t('exercise.workoutPlaybackPage.progress', 'Progress')}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {stats?.completedSets ?? 0}/{stats?.totalSets ?? 0}{' '}
                {t('exercise.workoutPlaybackDialog.sets', 'sets')}
              </div>
            </div>
          </div>

          <Progress value={(stats?.completionRate ?? 0) * 100} />

          <div className="space-y-1.5">
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

      <div className="space-y-3">
        {draft.exercises.map((exercise, exerciseIndex) => {
          const completedSets = exercise.sets.filter(
            (set) => set.completed
          ).length;
          const totalSets = exercise.sets.length;
          const isComplete = totalSets > 0 && completedSets === totalSets;
          const exerciseKey = `${exercise.exercise_id}-${exerciseIndex}`;
          const isExpanded = exerciseVisibility[exerciseKey] ?? !isComplete;

          return (
            <Card key={`${exercise.exercise_id}-${exerciseIndex}`}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">
                      {exercise.exercise_name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {completedSets}/{totalSets}{' '}
                      {t('exercise.workoutPlaybackDialog.sets', 'sets')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpanded && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddSet(exerciseIndex)}
                        aria-label={`Add set for ${exercise.exercise_name}`}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t('common.add', 'Add')}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer"
                      onClick={() =>
                        toggleExerciseVisibility(exerciseKey, !isExpanded)
                      }
                      aria-label={
                        isExpanded
                          ? `Collapse ${exercise.exercise_name}`
                          : `Expand ${exercise.exercise_name}`
                      }
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        isComplete
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
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
                <CardContent className="pt-0 pb-3">
                  <div className="space-y-1.5">
                    <div className="hidden sm:block overflow-x-auto px-3 pb-1">
                      <div className="flex items-center gap-2 min-w-[810px] text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
                      const isActive =
                        currentPointer?.exerciseIndex === exerciseIndex &&
                        currentPointer?.setIndex === setIndex;
                      const showInlineRestIndicator =
                        draft.rest_timer.state !== 'idle' &&
                        draft.rest_timer.target_exercise_index ===
                          pointer.exerciseIndex &&
                        draft.rest_timer.target_set_index === pointer.setIndex;

                      const restProgress =
                        draft.rest_timer.duration_seconds > 0
                          ? (draft.rest_timer.remaining_seconds /
                              draft.rest_timer.duration_seconds) *
                            100
                          : 0;

                      return (
                        <div
                          key={`${exercise.exercise_id}-${exerciseIndex}-${setIndex}`}
                        >
                          {showInlineRestIndicator && (
                            <div className="mb-1 rounded-md border border-amber-400/40 bg-amber-50/70 dark:bg-amber-950/25 p-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className="font-medium">
                                  {t(
                                    'exercise.workoutPlaybackPage.restBeforeSet',
                                    'Rest before Set {{setNumber}}: {{time}}',
                                    {
                                      setNumber: set.set_number,
                                      time: formatDurationClock(
                                        draft.rest_timer.remaining_seconds
                                      ),
                                    }
                                  )}
                                </span>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handlePauseResumeRest}
                                  >
                                    {draft.rest_timer.state === 'running' ? (
                                      <>
                                        <Pause className="mr-1 h-4 w-4" />
                                        {t('common.pause', 'Pause')}
                                      </>
                                    ) : (
                                      <>
                                        <Play className="mr-1 h-4 w-4" />
                                        {t('common.resume', 'Resume')}
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSkipRest}
                                  >
                                    <SkipForward className="mr-1 h-4 w-4" />
                                    {t('common.skip', 'Skip')}
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-2">
                                <Progress
                                  value={restProgress}
                                  className={
                                    draft.rest_timer.state === 'running'
                                      ? 'animate-pulse'
                                      : undefined
                                  }
                                />
                              </div>
                            </div>
                          )}

                          {/* Set card - no role="button" to avoid a11y violations */}
                          <div
                            className={`w-full text-left rounded-md px-3 py-2 transition-all border ${
                              isActive
                                ? 'bg-primary/15 border-primary/50 ring-2 ring-primary/30'
                                : 'hover:bg-muted border-transparent'
                            } ${set.completed ? 'opacity-60' : ''}`}
                          >
                            <div className="space-y-2">
                              <div className="overflow-x-auto">
                                <div className="flex items-center gap-2 min-w-max md:min-w-[600px]">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className={`px-2 py-1 h-auto ${
                                      isActive ? 'font-semibold' : ''
                                    }`}
                                    aria-label={`Select set ${set.set_number} for ${exercise.exercise_name}`}
                                    onClick={() => {
                                      updateDraft((currentDraft) =>
                                        setWorkoutPlaybackPointer(
                                          currentDraft,
                                          pointer
                                        )
                                      );
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        aria-label={`Complete set ${set.set_number}`}
                                        checked={set.completed}
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
                                  </Button>

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
                                      className="border-0 bg-transparent"
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
                                      placeholder={t('common.weight', 'Weight')}
                                      className="border-0 bg-transparent"
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
                                        { time: formatRestChip(set.rest_time) }
                                      )}
                                    </Button>
                                  </div>

                                  <div className="w-20 flex items-center justify-end gap-0.5">
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
                                  className="border-0 bg-transparent"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
    </div>
  );
};

export default WorkoutPlaybackPage;
