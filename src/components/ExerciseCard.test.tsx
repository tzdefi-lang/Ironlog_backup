import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ExerciseCard from '@/components/ExerciseCard';
import { I18nProvider } from '@/i18n/I18nProvider';

const baseProps = {
  ex: {
    id: 'instance-1',
    defId: 'def-1',
    sets: [
      {
        id: 'set-1',
        weight: 100,
        reps: 8,
        completed: false,
      },
    ],
  },
  index: 0,
  total: 1,
  currentUnit: 'LBS',
  unit: 'lbs' as const,
  isDragging: false,
  onOpenEdit: vi.fn(),
  onOpenDetail: vi.fn(),
  onRemove: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
  onHandlePointerDown: vi.fn(),
  onHandlePointerMove: vi.fn(),
  onHandlePointerUp: vi.fn(),
  onHandlePointerCancel: vi.fn(),
  onUpdateSet: vi.fn(),
  onDeleteSet: vi.fn(),
  onAddSet: vi.fn(),
};

describe('ExerciseCard detail triggers', () => {
  it('opens detail when thumbnail is tapped', () => {
    const onOpenDetail = vi.fn();

    render(
      <I18nProvider>
        <ExerciseCard
          {...baseProps}
          onOpenDetail={onOpenDetail}
          def={{
            id: 'def-1',
            name: 'Bench Press',
            description: 'desc',
            source: 'personal',
            readOnly: false,
            thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
            markdown: '',
            mediaItems: [],
          }}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByLabelText('Open Bench Press details'));
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
  });

  it('shows info button for text-only rich content', () => {
    render(
      <I18nProvider>
        <ExerciseCard
          {...baseProps}
          def={{
            id: 'def-2',
            name: 'Plank',
            description: '',
            source: 'personal',
            readOnly: false,
            markdown: 'Hold 30s and breathe.',
            mediaItems: [],
          }}
        />
      </I18nProvider>
    );

    expect(screen.getByLabelText('Open exercise details')).toBeInTheDocument();
  });
});
