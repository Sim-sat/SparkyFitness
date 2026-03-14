import {
  exercisesResponseSchema,
  exerciseEntriesResponseSchema,
  exercisePresetEntriesResponseSchema,
} from '@workspace/shared';
import { z } from 'zod';

/**
 * Helper to ensure IDs are strings
 */
const idSchema = z
  .union([z.string(), z.number()])
  .transform((val) => String(val));

/**
 * Strict schema for frontend Exercise
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

/**
 * Strict schema for frontend ExerciseEntry
 */
export const exerciseEntrySchema = exerciseEntriesResponseSchema.extend({
  id: idSchema,
  exercise_id: idSchema,
  entry_date: z.string(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  exercise_preset_entry_id: idSchema.optional(),
  exercise_snapshot: exerciseSchema,
  sets: z.array(z.any()), // Types cast in exercise types
  activity_details: z.array(z.any()).optional(),
});

/**
 * Schema for individual entries in grouped response
 */
const individualGroupedEntrySchema = exerciseEntrySchema.extend({
  type: z.literal('individual'),
});

/**
 * Schema for preset entries in grouped response
 */
const presetGroupedEntrySchema = exercisePresetEntriesResponseSchema.extend({
  type: z.literal('preset'),
  id: idSchema,
  workout_preset_id: idSchema,
  exercises: z.array(exerciseEntrySchema).optional(),
});

export const groupedExerciseEntrySchema = z.discriminatedUnion('type', [
  individualGroupedEntrySchema,
  presetGroupedEntrySchema,
]);
