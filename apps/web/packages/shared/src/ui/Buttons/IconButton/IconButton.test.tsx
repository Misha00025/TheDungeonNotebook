import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import IconButton from './IconButton';
import styles from './IconButton.module.css';
import buttonStyles from '../../../styles/components/Button.module.css';

describe('IconButton', () => {
  test('renders check and close SVG icons with an accessible button name', () => {
    const onClick = vi.fn();
    const { rerender } = render(<IconButton icon="check" title="Confirm" ariaLabel="Confirm change" onClick={onClick} />);
    const checkButton = screen.getByRole('button', { name: 'Confirm change' });
    expect(checkButton).toHaveAttribute('type', 'button');
    expect(checkButton.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(checkButton.className).toContain(styles.small);
    rerender(<IconButton icon="close" title="Close dialog" onClick={onClick} />);
    expect(screen.getByRole('button', { name: 'Close dialog' }).querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  test('preserves legacy icon markup', () => {
    render(<IconButton icon="edit" title="Edit" onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button.querySelector('svg')).toBeNull();
    expect(button.querySelector(`.${styles.icon}.${styles.edit}`)).toBeInTheDocument();
  });

  test('adds className without replacing SDK classes or native button behavior', () => {
    const onClick = vi.fn();
    render(<IconButton icon="close" title="Close" size="large" variant="secondary" className="notification-close" disabled onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button).toHaveClass(buttonStyles.button, styles.iconButton, styles.large, styles.secondary, 'notification-close');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('disabled and busy buttons do not invoke click handlers', () => {
    const onClick = vi.fn();
    const { rerender } = render(<IconButton icon="check" title="Save" disabled onClick={onClick} />);
    const disabledButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(disabledButton);
    expect(disabledButton).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
    rerender(<IconButton icon="check" title="Save" busy onClick={onClick} />);
    const busyButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(busyButton);
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute('aria-busy', 'true');
    expect(onClick).not.toHaveBeenCalled();
  });
});
