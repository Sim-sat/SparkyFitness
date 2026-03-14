import { z } from "zod";
import {
  workoutPlanAssignmentSetsInitializerSchema,
  workoutPlanAssignmentSetsMutatorSchema,
  workoutPlanAssignmentSetsSchema,
} from "../database/WorkoutPlanAssignmentSets.zod";
import {
  exerciseSetTypeSchema,
  idResponseSchema,
} from "./CommonExercise.api.zod";

export const workoutPlanAssignmentSetsResponseSchema =
  workoutPlanAssignmentSetsSchema.extend({
    id: idResponseSchema,
    assignment_id: idResponseSchema,
    set_type: exerciseSetTypeSchema.nullable().or(z.string().nullable()),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
  });

export const createWorkoutPlanAssignmentSetsRequestSchema =
  workoutPlanAssignmentSetsInitializerSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

export const updateWorkoutPlanAssignmentSetsRequestSchema =
  workoutPlanAssignmentSetsMutatorSchema.omit({
    created_at: true,
    updated_at: true,
  });

export type WorkoutPlanAssignmentSetsResponse = z.infer<
  typeof workoutPlanAssignmentSetsResponseSchema
>;
export type CreateWorkoutPlanAssignmentSetsRequest = z.infer<
  typeof createWorkoutPlanAssignmentSetsRequestSchema
>;
export type UpdateWorkoutPlanAssignmentSetsRequest = z.infer<
  typeof updateWorkoutPlanAssignmentSetsRequestSchema
>;
