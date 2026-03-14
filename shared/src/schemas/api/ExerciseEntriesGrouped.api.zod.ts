import { z } from "zod";
import { exerciseEntriesResponseSchema } from "./ExerciseEntries.api.zod";
import { exercisePresetEntriesResponseSchema } from "./ExercisePresetEntries.api.zod";
import { exerciseEntryActivityDetailsResponseSchema } from "./ExerciseEntryActivityDetails.api.zod";

/**
 * Schema for individual entries in grouped response
 */
export const individualGroupedEntrySchema = exerciseEntriesResponseSchema.extend({
  type: z.literal("individual"),
  activity_details: z.array(exerciseEntryActivityDetailsResponseSchema).optional(),
});

/**
 * Schema for preset entries in grouped response
 */
export const presetGroupedEntrySchema = exercisePresetEntriesResponseSchema.extend({
  type: z.literal("preset"),
  activity_details: z.array(exerciseEntryActivityDetailsResponseSchema).optional(),
});

/**
 * Discriminated union for grouped exercise entries (individual or preset)
 */
export const groupedExerciseEntrySchema = z.discriminatedUnion("type", [
  individualGroupedEntrySchema,
  presetGroupedEntrySchema,
]);

export type GroupedExerciseEntry = z.infer<typeof groupedExerciseEntrySchema>;
