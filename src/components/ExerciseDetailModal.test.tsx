import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ExerciseDetailModal from '@/components/ExerciseDetailModal';
import { I18nProvider } from '@/i18n/I18nProvider';
import type { ExerciseDef } from '@/types';

const renderModal = (exercise: ExerciseDef, opts?: Partial<React.ComponentProps<typeof ExerciseDetailModal>>) =>
  render(
    <I18nProvider>
      <ExerciseDetailModal isOpen={true} exercise={exercise} onClose={() => {}} {...opts} />
    </I18nProvider>
  );

describe('ExerciseDetailModal', () => {
  it('renders a swipe-only carousel (no arrow buttons)', () => {
    const { container } = renderModal({
      id: 'ex-1',
      name: 'Bench Press',
      description: 'desc',
      source: 'personal',
      readOnly: false,
      markdown: '### Notes',
      mediaItems: [
        {
          id: 'm1',
          kind: 'upload',
          contentType: 'image',
          url: 'https://cdn.example.com/1.jpg',
        },
        {
          id: 'm2',
          kind: 'youtube',
          contentType: 'video',
          url: 'https://www.youtube.com/embed/abc123',
        },
      ],
    });

    const carousel = screen.getByTestId('exercise-detail-carousel');
    expect(carousel).toBeInTheDocument();
    expect(screen.queryByLabelText('Previous media')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Next media')).not.toBeInTheDocument();
    expect(carousel.querySelector('iframe')).not.toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeInTheDocument();
  });

  it('renders uploaded videos as looping muted "GIF" videos (no controls)', () => {
    const { container } = renderModal({
      id: 'ex-video',
      name: 'Dumbbell Curl',
      description: '',
      source: 'personal',
      readOnly: false,
      markdown: '',
      mediaItems: [
        {
          id: 'mv1',
          kind: 'upload',
          contentType: 'video',
          url: 'https://cdn.example.com/curl.mp4',
        },
      ],
    });

    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video?.autoplay).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.controls).toBe(false);
  });

  it('embeds YouTube when a paragraph contains only a YouTube URL', () => {
    const { container } = renderModal({
      id: 'ex-yt',
      name: 'Plank',
      description: '',
      source: 'personal',
      readOnly: false,
      markdown: 'https://www.youtube.com/watch?v=abc123',
      mediaItems: [],
    });

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/abc123?playsinline=1');
  });

  it('embeds YouTube when a paragraph contains a scheme-less YouTube URL', () => {
    const { container } = renderModal({
      id: 'ex-yt-raw',
      name: 'Plank',
      description: '',
      source: 'personal',
      readOnly: false,
      markdown: 'youtube.com/watch?v=abc123',
      mediaItems: [],
    });

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/abc123?playsinline=1');
  });

  it('does not embed YouTube when the link is inside a sentence', () => {
    const { container } = renderModal({
      id: 'ex-yt-2',
      name: 'Plank',
      description: '',
      source: 'personal',
      readOnly: false,
      markdown: 'See https://www.youtube.com/watch?v=abc123 for form cues.',
      mediaItems: [],
    });

    expect(container.querySelector('iframe')).not.toBeInTheDocument();
  });

  it('renders the detail stats strip when current exercise context is provided', () => {
    renderModal({
      id: 'ex-2',
      name: 'Plank',
      description: 'Hold 30s',
      source: 'personal',
      readOnly: false,
      markdown: 'Focus on breathing.',
      mediaItems: [],
    }, {
      currentWorkoutId: 'w-current',
      currentExercise: {
        id: 'inst-1',
        defId: 'ex-2',
        sets: [
          { id: 's1', weight: 40, reps: 10, completed: true }, // volume 400
          { id: 's2', weight: 45, reps: 5, completed: false },
        ],
      },
      workouts: [
        {
          id: 'w-current',
          date: '2026-02-12',
          title: '',
          note: '',
          completed: false,
          elapsedSeconds: 0,
          startTimestamp: null,
          exercises: [],
        },
        {
          id: 'w-last',
          date: '2026-02-10',
          title: '',
          note: '',
          completed: true,
          elapsedSeconds: 0,
          startTimestamp: null,
          exercises: [
            {
              id: 'e1',
              defId: 'ex-2',
              sets: [{ id: 'ls1', weight: 50, reps: 10, completed: true }], // volume 500
            },
          ],
        },
        {
          id: 'w-pr',
          date: '2026-02-01',
          title: '',
          note: '',
          completed: true,
          elapsedSeconds: 0,
          startTimestamp: null,
          exercises: [
            {
              id: 'e2',
              defId: 'ex-2',
              sets: [{ id: 'ps1', weight: 60, reps: 10, completed: true }], // volume 600
            },
          ],
        },
      ],
    });

    const strip = screen.getByTestId('exercise-detail-stats');
    const scope = within(strip);
    expect(scope.getByText('400')).toBeInTheDocument();
    expect(scope.getByText('500')).toBeInTheDocument();
    expect(scope.getByText('600')).toBeInTheDocument();
  });
});
