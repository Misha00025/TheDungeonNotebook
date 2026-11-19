import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PersonalizeModal from './PersonalizeModal';

const theme = vi.hoisted(() => ({
  themeConfig: { type: 'preset' as const, name: 'clean' as const },
  setPreset: vi.fn(),
  setCustomColors: vi.fn(),
  getCurrentColors: vi.fn(() => ({ bgPrimary: '#ffffff', textPrimary: '#000000', accentColor: '#222222', progressFrom: '#e53935', progressTo: '#66bb6a' })),
  pushThemeToServer: vi.fn(),
  syncThemeFromServer: vi.fn(),
  themeSyncing: false,
  themeSyncError: null as unknown,
}));

vi.mock('../../theme/ThemeContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../theme/ThemeContext')>();
  return { ...actual, useTheme: () => theme };
});

describe('PersonalizeModal notifications', () => {
  beforeEach(() => {
    theme.themeSyncError = null;
    theme.themeSyncing = false;
    theme.syncThemeFromServer.mockReset().mockResolvedValue(undefined);
    theme.pushThemeToServer.mockReset();
    theme.setPreset.mockReset();
    theme.setCustomColors.mockReset();
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('shows theme sync success and keeps the sync command available after expiry', async () => {
    vi.useFakeTimers();
    render(<PersonalizeModal isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Синхронизировать' }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('status')).toHaveTextContent('Тема синхронизирована');
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByText('Тема синхронизирована')).toBeNull();
    expect(screen.getByRole('button', { name: 'Синхронизировать' })).toBeEnabled();
    expect(theme.syncThemeFromServer).toHaveBeenCalledTimes(1);
  });

  it('shows generic sync failure without raw error text', async () => {
    theme.themeSyncError = new Error('private sync details');
    theme.syncThemeFromServer.mockRejectedValue(new Error('private sync details'));
    render(<PersonalizeModal isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Не удалось синхронизировать тему. Попробуйте ещё раз.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('private sync details');
    fireEvent.click(screen.getByRole('button', { name: 'Синхронизировать' }));
    await waitFor(() => expect(theme.syncThemeFromServer).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Не удалось синхронизировать тему. Попробуйте ещё раз.')).toBeInTheDocument();
  });

  it('does not render a notification while the modal is closed', () => {
    theme.themeSyncError = new Error('private sync details');
    const view = render(<PersonalizeModal isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Не удалось синхронизировать тему. Попробуйте ещё раз.')).toBeInTheDocument();
    view.rerender(<PersonalizeModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Не удалось синхронизировать тему. Попробуйте ещё раз.')).toBeNull();
  });
});
