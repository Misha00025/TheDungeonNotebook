import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Login from '../../../login/src/pages/Login';

const auth = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock('@tdn/shared', () => ({ useAuth: () => auth }));

describe('remote login page', () => {
  it('shows the centered anonymous message and calls login when clicked', () => {
    render(<Login />);

    const heading = screen.getByRole('heading', { name: 'Вы не авторизованы' });
    expect(heading).toHaveStyle({ textAlign: 'center' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    expect(screen.queryByText('Вход в The Dungeon Notebook')).not.toBeInTheDocument();
    expect(screen.queryByText('Вход и регистрация выполняются у провайдера учётных записей.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(auth.login).toHaveBeenCalledWith();
  });
});
