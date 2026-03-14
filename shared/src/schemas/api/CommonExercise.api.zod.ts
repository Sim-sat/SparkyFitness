import { z } from "zod";

/**
 * Shared set type enum used by ExerciseEntrySets and WorkoutPresetExerciseSets
 */
export const exerciseSetTypeSchema = z.enum([
  "Working Set",
  "Warm-up",
  "Drop Set",
  "Failure",
  "AMRAP",
  "Back-off",
  "Rest-Pause",
  "Cluster",
  "Technique",
]);

/**
 * Helper to ensure IDs are strings in API responses
 */
export const idResponseSchema = z
  .union([z.string(), z.number()])
  .transform((val) => String(val));
