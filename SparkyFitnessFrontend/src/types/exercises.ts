import { ActivityDetailKeyValuePair } from '@/components/ExerciseActivityDetailsEditor';
import {
  exercisesResponseSchema,
  exerciseEntriesResponseSchema,
  exercisePresetEntriesResponseSchema,
  exerciseEntrySetsResponseSchema,
  exerciseEntryActivityDetailsResponseSchema,
} from '@workspace/shared';
import { WorkoutPresetSet } from './workout';
import { z } from 'zod';

/**
 * Helper to ensure IDs are strings
 */
const idSchema = z
  .union([z.string(), z.number()])
  .transform((val) => String(val));

/**
 * Strict schema for Exercise
 */
export const exerciseSchema = exercisesResponseSchema.extend({
  id: idSchema,
  equipment: z.preprocess(
    (val) => (typeof val === 'string' ? JSON.parse(val) : val),
    z.array(z.string()).nullish()
  ),
  primary_muscles: z.preprocess(
    (val) => (typeof val === 'string' ? JSON.parse(val) : val),
    z.array(z.string()).nullish()
  ),
  secondary_muscles: z.preprocess(
    (val) => (typeof val === 'string' ? JSON.parse(val) : val),
    z.array(z.string()).nullish()
  ),
  instructions: z.preprocess(
    (val) => (typeof val === 'string' ? JSON.parse(val) : val),
    z.array(z.string()).nullish()
  ),
  images: z.preprocess(
    (val) => (typeof val === 'string' ? JSON.parse(val) : val),
    z.array(z.string()).nullish()
  ),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  description: z.string().nullish(),
  duration_min: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

export type Exercise = z.infer<typeof exerciseSchema>;

/**
 * Strict schema for ExerciseEntry
 */
export const exerciseEntrySchema = exerciseEntriesResponseSchema.extend({
  id: idSchema,
  exercise_id: idSchema,
  entry_date: z.string(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  exercise_preset_entry_id: idSchema.optional(),
  exercise_snapshot: exerciseSchema,
  sets: z
    .array(exerciseEntrySetsResponseSchema)
    .transform((val) => val as unknown as WorkoutPresetSet[]),
  activity_details: z
    .array(exerciseEntryActivityDetailsResponseSchema)
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return val.map((detail) => ({
        ...detail,
        key: detail.detail_type,
        value:
          typeof detail.detail_data === 'string'
            ? detail.detail_data
            : JSON.stringify(detail.detail_data),
      })) as ActivityDetailKeyValuePair[];
    }),
});

export type ExerciseEntry = z.infer<typeof exerciseEntrySchema>;

/**
 * Schema for individual entries in grouped response
 */
export const individualGroupedEntrySchema = exerciseEntrySchema.extend({
  type: z.literal('individual'),
});

export type IndividualGroupedEntry = z.infer<
  typeof individualGroupedEntrySchema
>;

/**
 * Schema for preset entries in grouped response
 */
export const presetGroupedEntrySchema =
  exercisePresetEntriesResponseSchema.extend({
    type: z.literal('preset'),
    id: idSchema,
    workout_preset_id: idSchema,
    exercises: z.array(exerciseEntrySchema).optional(),
  });

export type PresetGroupedEntry = z.infer<typeof presetGroupedEntrySchema>;

export const groupedExerciseEntrySchema = z.discriminatedUnion('type', [
  individualGroupedEntrySchema,
  presetGroupedEntrySchema,
]);

export type GroupedExerciseEntry = z.infer<typeof groupedExerciseEntrySchema>;

export interface HistoryImportEntry {
  entry_date: string;
  id: string;
  exercise_name: string;
  preset_name?: string;
  entry_notes?: string;
  calories_burned?: number;
  distance?: number;
  avg_heart_rate?: number;
  exercise_category?: string;
  calories_per_hour?: number;
  exercise_description?: string;
  exercise_source?: string;
  exercise_force?: string;
  exercise_level?: string;
  exercise_mechanic?: string;
  exercise_equipment?: string[];
  primary_muscles?: string[];
  secondary_muscles?: string[];
  instructions?: string[];
  sets?: {
    set_number: number;
    set_type?: string;
    reps?: number;
    weight?: number;
    duration_min?: number;
    rest_time_sec?: number;
    notes?: string;
  }[];
  activity_details?: unknown[];
}

export interface ExerciseDeletionImpact {
  exerciseEntriesCount: number;
  // server returns counts; normalize to a boolean for backward compatible UI use
  isUsedByOthers: boolean;
  otherUserReferences?: number;
}

export type ExerciseOwnershipFilter =
  | 'all'
  | 'own'
  | 'family'
  | 'public'
  | 'needs-review';

export interface LapDTO {
  distance: number;
  duration: number;
  movingDuration: number;
  averageMovingSpeed: number;
}
