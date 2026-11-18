import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import TabBar from './TabBar';

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

afterEach(() => {
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  else Reflect.deleteProperty(window, 'matchMedia');
});

describe('TabBar', () => {
  test('joins base paths without duplicate slashes and marks the active tab by default', () => {
    render(
      <MemoryRouter initialEntries={['/groups/12/gm/overview']}>
        <TabBar basePath="/groups/12/gm/" tabs={[{ id: 'overview', label: 'Overview', path: '/overview' }]} />
      </MemoryRouter>
    );
    const navigation = screen.getByRole('navigation', { name: 'Разделы' });
    const link = screen.getByRole('link', { name: 'Overview' });
    expect(link).toHaveAttribute('href', '/groups/12/gm/overview');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  test('returns null for hideOnMobile when the media query matches', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({ media: query, matches: true, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })),
    });
    render(<MemoryRouter><TabBar basePath="/groups/12/gm" hideOnMobile tabs={[]} /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Разделы' })).not.toBeInTheDocument());
  });
});
