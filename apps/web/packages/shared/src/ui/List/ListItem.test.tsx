import React from 'react';
import { render, screen } from '@testing-library/react';
import ListItem from './ListItem';
import styles from './ListItem.module.css';

describe('ListItem', () => {
  test('preserves native clickable semantics with compact density', () => {
    const { container } = render(<ListItem density="compact" clickable meta="Meta" actions={<button>Action</button>}>Entry</ListItem>);
    const item = container.firstElementChild as HTMLElement;
    expect(item).toHaveClass(styles.compact, styles.withDetails, styles.clickable);
    expect(item).not.toHaveAttribute('density');
    expect(item).toHaveAttribute('role', 'button');
    expect(item).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('Meta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  test('keeps default density by default', () => {
    const { container } = render(<ListItem>Entry</ListItem>);
    expect(container.firstElementChild).not.toHaveClass(styles.compact);
  });
});
