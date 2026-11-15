import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import GlobalSidebar from './GlobalSidebar';

const mocks = vi.hoisted(() => ({ logout: vi.fn(), sidebar: { isOpen: false, open: vi.fn(), close: vi.fn() } }));

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ logout: mocks.logout }) }));
vi.mock('../SidebarContext', () => ({ useSidebar: () => mocks.sidebar }));
vi.mock('../Buttons/ThemeToggle/ThemeToggle', () => ({ default: () => null }));

const Location = () => <span data-testid="path">{useLocation().pathname}</span>;

describe('GlobalSidebar logout', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.sidebar.isOpen = false; });

  it('navigates to login only after successful logout', async () => {
    mocks.logout.mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter initialEntries={['/profile']}><GlobalSidebar navItems={[]} /><Location /></MemoryRouter>);
    fireEvent.click(screen.getByText('Выйти'));
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('path').textContent).toBe('/profile');
    mocks.logout.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByText('Выйти'));
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/login'));
  });

  it('disables the logout control while the request is pending', async () => {
    let resolve!: () => void;
    mocks.logout.mockReturnValueOnce(new Promise<void>(r => { resolve = r; }));
    render(<MemoryRouter><GlobalSidebar navItems={[]} /></MemoryRouter>);
    const button = screen.getByText('Выйти').closest('button') as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    resolve();
  });
});
