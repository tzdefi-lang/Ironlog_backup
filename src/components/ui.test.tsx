import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button, Modal } from '@/components/ui';

describe('ui components', () => {
  it('Button renders and handles click', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save Workout</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Save Workout' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Modal renders content when open and supports close interactions', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Workout Details">
        <p>Session notes</p>
      </Modal>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Session notes')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close'));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Modal stays hidden when closed', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Hidden Modal">
        <p>Should not show</p>
      </Modal>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Should not show')).not.toBeInTheDocument();
  });
});
