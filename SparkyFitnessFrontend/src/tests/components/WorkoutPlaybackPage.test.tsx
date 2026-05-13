import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkoutPlaybackPage from '@/pages/Diary/WorkoutPlaybackPage';
import type { WorkoutPreset } from '@/types/workout';
import { createWorkoutPlaybackDraftFromPreset } from '@/utils/workoutPlayback';

const mockNavigate = jest.fn();
const mockCreatePresetSession = jest.fn();
const mockSearchParams = new URLSearchParams('date=2026-04-27');
let mockLocationState: { returnTo?: string; draft?: unknown } | null = null;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: mockLocationState }),
  useSearchParams: () => [mockSearchParams],
}));

jest.mock('@/hooks/Exercises/useExerciseEntries', () => ({
  useCreatePresetSessionMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockCreatePresetSession(...args),
    isPending: false,
  }),
}));

const presetFixture: WorkoutPreset = {
  id: 'preset-1',
  user_id: 'user-1',
  name: 'Upper Body',
  description: 'Push + Pull',
  exercises: [
    {
      exercise_id: 'exercise-1',
      exercise_name: 'Bench Press',
      sets: [{ set_number: 1, reps: 8, weight: 80, rest_time: 90 }],
    },
    {
      exercise_id: 'exercise-2',
      exercise_name: 'Barbell Row',
      sets: [{ set_number: 1, reps: 10, weight: 60, rest_time: 90 }],
    },
  ],
} as unknown as WorkoutPreset;

describe('WorkoutPlaybackPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreatePresetSession.mockReset();
    mockLocationState = { returnTo: '/?date=2026-04-27' };
  });

  it('shows elapsed timer and collapses completed exercises', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      presetFixture,
      '2026-04-27'
    );
    if (draft.exercises[0]?.sets[0]) {
      draft.exercises[0].sets[0].completed = true;
    }
    draft.active_exercise_index = 1;
    draft.active_set_index = 0;
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    expect(screen.getAllByText('Duration').length).toBeGreaterThan(0);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThanOrEqual(2);
  });

  it('starts rest countdown when current set is completed', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      presetFixture,
      '2026-04-27'
    );
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    fireEvent.click(screen.getAllByLabelText('Complete set 1')[0]!);

    expect(
      screen.getAllByRole('button', { name: 'Pause' }).length
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText('Pause')).toBeInTheDocument();
  });

  it('allows editing set values and adding/removing sets', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      presetFixture,
      '2026-04-27'
    );
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    const repsInput = screen.getAllByLabelText(
      'Reps set 1'
    )[0] as HTMLInputElement;
    fireEvent.change(repsInput, { target: { value: '12' } });
    expect(repsInput.value).toBe('12');

    fireEvent.click(screen.getByLabelText('Add set for Bench Press'));
    expect(screen.getAllByLabelText('Reps set 2').length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getAllByLabelText('Remove set 2 for Bench Press')[0]!
    );
    expect(screen.queryByLabelText('Reps set 2')).not.toBeInTheDocument();

    const sessionNotes = screen.getAllByPlaceholderText(
      'Any notes about this session...'
    )[0] as HTMLTextAreaElement;
    fireEvent.change(sessionNotes, { target: { value: 'Felt strong today' } });
    expect(sessionNotes.value).toBe('Felt strong today');

    expect(screen.queryByLabelText('Set notes 1')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText('Toggle notes for set 1')[0]!);
    expect(screen.getByLabelText('Set notes 1')).toBeInTheDocument();
  });

  it('edits rest via rest chip presets', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      presetFixture,
      '2026-04-27'
    );
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    fireEvent.click(screen.getAllByLabelText('Edit rest for set 1')[0]!);
    fireEvent.click(screen.getByRole('button', { name: '2:00' }));

    fireEvent.click(screen.getAllByLabelText('Edit rest for set 1')[0]!);
    expect(screen.getByLabelText('Custom (seconds)')).toHaveValue(120);
  });

  it('keeps rest indicator anchored to next set even when selecting others', () => {
    const draft = createWorkoutPlaybackDraftFromPreset(
      presetFixture,
      '2026-04-27'
    );
    if (draft.exercises[0]?.sets[0]) {
      draft.exercises[0].sets.push({
        ...draft.exercises[0].sets[0],
        set_number: 2,
      });
    }
    mockLocationState = { returnTo: '/?date=2026-04-27', draft };

    render(<WorkoutPlaybackPage />);

    fireEvent.click(screen.getAllByLabelText('Complete set 1')[0]!);
    expect(screen.getByLabelText('Pause')).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByLabelText('Select set 2 for Bench Press')[0]!
    );

    expect(screen.getByLabelText('Pause')).toBeInTheDocument();
  });
});
