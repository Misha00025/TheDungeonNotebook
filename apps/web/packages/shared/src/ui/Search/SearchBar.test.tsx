import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SearchBar from './SearchBar';
import styles from './SearchBar.module.css';

describe('SearchBar', () => {
  test('provides an accessible input name and clears by button or Escape', () => {
    const onSearchChange = vi.fn();
    const { rerender } = render(<SearchBar searchTerm="dragons" onSearchChange={onSearchChange} />);
    const input = screen.getByRole('textbox', { name: 'Поиск' });
    fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }));
    expect(onSearchChange).toHaveBeenCalledWith('');
    onSearchChange.mockClear();
    rerender(<SearchBar searchTerm="dragons" onSearchChange={onSearchChange} />);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  test('supports a custom accessible name and compact class', () => {
    const { container } = render(
      <SearchBar searchTerm="" onSearchChange={vi.fn()} aria-label="Find campaign" compact />
    );
    expect(screen.getByRole('textbox', { name: 'Find campaign' })).toBeInTheDocument();
    expect(container.firstChild).toHaveClass(styles.compact);
  });
});
