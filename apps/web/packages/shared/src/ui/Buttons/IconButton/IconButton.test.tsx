import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IconButton from './IconButton';

describe('IconButton', () => {
  it.each(['check', 'close', 'undo', 'edit', 'copy', 'more'] as const)('invokes its command for the %s icon', icon => {
    const onClick = vi.fn();
    render(<IconButton icon={icon} title="Restore field" ariaLabel="Restore selected field" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Restore selected field' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('title', 'Restore field');
    expect(button).toHaveAttribute('aria-label', 'Restore selected field');
    if (icon === 'copy' || icon === 'more') expect(button.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each(['undo', 'copy', 'more'] as const)('does not invoke its command for %s when disabled or busy', icon => {
    const onClick = vi.fn();
    const { rerender } = render(<IconButton icon={icon} title="Restore" disabled onClick={onClick} />);
    const disabledButton = screen.getByRole('button', { name: 'Restore' });
    expect(disabledButton).toBeDisabled();
    fireEvent.click(disabledButton);
    expect(onClick).not.toHaveBeenCalled();

    rerender(<IconButton icon={icon} title="Restore" busy onClick={onClick} />);
    const busyButton = screen.getByRole('button', { name: 'Restore' });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(busyButton);
    expect(onClick).not.toHaveBeenCalled();
  });
});
