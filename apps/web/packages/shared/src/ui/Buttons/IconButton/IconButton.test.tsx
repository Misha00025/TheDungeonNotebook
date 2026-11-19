import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IconButton from './IconButton';

describe('IconButton', () => {
  it.each(['check', 'close', 'undo', 'edit'] as const)('invokes its command for the %s icon', icon => {
    const onClick = vi.fn();
    render(<IconButton icon={icon} title="Restore field" ariaLabel="Restore selected field" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Restore selected field' });
    expect(button).toHaveAttribute('type', 'button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not invoke its command when disabled or busy', () => {
    const onClick = vi.fn();
    const { rerender } = render(<IconButton icon="undo" title="Restore" disabled onClick={onClick} />);
    const disabledButton = screen.getByRole('button', { name: 'Restore' });
    expect(disabledButton).toBeDisabled();
    fireEvent.click(disabledButton);
    expect(onClick).not.toHaveBeenCalled();

    rerender(<IconButton icon="undo" title="Restore" busy onClick={onClick} />);
    const busyButton = screen.getByRole('button', { name: 'Restore' });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(busyButton);
    expect(onClick).not.toHaveBeenCalled();
  });
});
