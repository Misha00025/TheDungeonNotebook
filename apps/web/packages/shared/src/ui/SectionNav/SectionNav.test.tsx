import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SectionNav from './SectionNav';

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

afterEach(() => {
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  else Reflect.deleteProperty(window, 'matchMedia');
});

describe('SectionNav', () => {
  test('returns null for hideOnMobile when the media query matches', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({ media: query, matches: true, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })),
    });
    render(<MemoryRouter><SectionNav aria-label="Campaign sections" hideOnMobile items={[{ label: 'Characters', to: '/characters' }]} /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Campaign sections' })).not.toBeInTheDocument());
  });

  test('preserves active router links by default', () => {
    const onClick = vi.fn();
    render(
      <MemoryRouter>
        <SectionNav
          aria-label="Campaign sections"
          items={[{ label: 'Characters', to: '/characters', active: true, onClick }]}
        />
      </MemoryRouter>
    );
    const navigation = screen.getByRole('navigation', { name: 'Campaign sections' });
    const link = screen.getByRole('link', { name: 'Characters' });
    expect(link).toHaveAttribute('href', '/characters');
    expect(link).toHaveAttribute('aria-current', 'page');
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
