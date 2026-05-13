import { useTranslation } from 'react-i18next';
import { ChevronDown, MessageSquare, Timer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { excerciseWorkoutSetTypes } from '@/constants/excerciseWorkoutSetTypes';
import {
  DEFAULT_REST_SECONDS,
  type WorkoutPlaybackDraft,
  type WorkoutSetPointer,
} from '@/utils/workoutPlayback';

const REST_LABEL_SECONDS = 60;

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

function formatRestChip(seconds: number | null | undefined): string {
  const value = seconds ?? DEFAULT_REST_SECONDS;
  if (value < REST_LABEL_SECONDS) {
    return `${value}s`;
  }

  return formatDurationClock(value);
}

interface WorkoutPlaybackExercisesListProps {
  draft: WorkoutPlaybackDraft;
  setNotesVisibility: Record<string, boolean>;
  onToggleSetNotesVisibility: (setKey: string) => void;
  onSelectSet: (pointer: WorkoutSetPointer) => void;
  onCompleteSet: (pointer: WorkoutSetPointer) => void;
  onUncompleteSet: (pointer: WorkoutSetPointer) => void;
  onSetFieldChange: (
    pointer: WorkoutSetPointer,
    field: 'reps' | 'weight' | 'rest_time' | 'set_type' | 'notes',
    value: number | string | null
  ) => void;
  onOpenRestEditor: (pointer: WorkoutSetPointer) => void;
  onRemoveSet: (pointer: WorkoutSetPointer) => void;
  onAddSet: (exerciseIndex: number) => void;
}

const WorkoutPlaybackExercisesList = ({
  draft,
  setNotesVisibility,
  onToggleSetNotesVisibility,
  onSelectSet,
  onCompleteSet,
  onUncompleteSet,
  onSetFieldChange,
  onOpenRestEditor,
  onRemoveSet,
  onAddSet,
}: WorkoutPlaybackExercisesListProps) => {
  const { t } = useTranslation();

  return (
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
            className="border-border/70 shadow-none"
          >
            <CardHeader className="px-3 py-2">
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
                      ? t('exercise.workoutPlaybackPage.completed', 'Completed')
                      : t(
                          'exercise.workoutPlaybackPage.inProgress',
                          'In Progress'
                        )}
                  </span>
                </div>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="px-3 pb-2 pt-0">
                <div className="space-y-1">
                  <div className="hidden overflow-x-auto pb-1 sm:block">
                    <div className="flex min-w-[640px] items-center gap-2 text-[10px] font-medium text-muted-foreground">
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
                                  onClick={() => onSelectSet(pointer)}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === 'Enter' ||
                                      event.key === ' '
                                    ) {
                                      event.preventDefault();
                                      onSelectSet(pointer);
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
                                        onCompleteSet(pointer);
                                      } else {
                                        onUncompleteSet(pointer);
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
                                      onToggleSetNotesVisibility(
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
                                      onRemoveSet(pointer);
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
                                      onSetFieldChange(
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
                                      {excerciseWorkoutSetTypes.map((type) => (
                                        <SelectItem key={type} value={type}>
                                          {t(`workout.setType.${type}`, type)}
                                        </SelectItem>
                                      ))}
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
                                    onSetFieldChange(
                                      pointer,
                                      'reps',
                                      event.target.value.trim() === ''
                                        ? null
                                        : Number(event.target.value)
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
                                    onSetFieldChange(
                                      pointer,
                                      'weight',
                                      event.target.value.trim() === ''
                                        ? null
                                        : Number(event.target.value)
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
                                      onOpenRestEditor(pointer);
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
                                <div className="flex min-w-[600px] items-center gap-2">
                                  <div
                                    className="flex w-44 cursor-pointer items-center gap-2 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                    aria-label={`Select set ${set.set_number} for ${exercise.exercise_name}`}
                                    onClick={() => onSelectSet(pointer)}
                                    onKeyDown={(event) => {
                                      if (
                                        event.key === 'Enter' ||
                                        event.key === ' '
                                      ) {
                                        event.preventDefault();
                                        onSelectSet(pointer);
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
                                          onCompleteSet(pointer);
                                        } else {
                                          onUncompleteSet(pointer);
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
                                        onSetFieldChange(
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
                                        onSetFieldChange(
                                          pointer,
                                          'reps',
                                          event.target.value.trim() === ''
                                            ? null
                                            : Number(event.target.value)
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
                                        onSetFieldChange(
                                          pointer,
                                          'weight',
                                          event.target.value.trim() === ''
                                            ? null
                                            : Number(event.target.value)
                                        )
                                      }
                                      placeholder={t('common.weight', 'Weight')}
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
                                        onOpenRestEditor(pointer);
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

                                  <div className="flex w-32 items-center justify-end gap-0.5">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="cursor-pointer"
                                      aria-label={`Toggle notes for set ${set.set_number}`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        onToggleSetNotesVisibility(
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
                                        onRemoveSet(pointer);
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
                                  onSetFieldChange(
                                    pointer,
                                    'notes',
                                    event.target.value
                                  )
                                }
                                placeholder={t(
                                  'workout.notesPlaceholder',
                                  'Add a note for this set...'
                                )}
                                className="resize-none text-sm focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {isExpanded && (
                  <div className="flex justify-center pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-0 text-xs text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
                      onClick={() => onAddSet(exerciseIndex)}
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
  );
};

export default WorkoutPlaybackExercisesList;
