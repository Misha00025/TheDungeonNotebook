import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CompleteRegistration from './CompleteRegistration';

const authState = vi.hoisted(() => ({ authenticated: true, userId: 9 as number | null }));

vi.mock('@tdn/shared/auth/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../../services/api', () => ({ userAPI: { createProfile: vi.fn() } }));

import { userAPI } from '../../services/api';

describe('CompleteRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.authenticated = true;
    authState.userId = 9;
  });

  it('keeps entered fields and does not complete when profile creation fails', async () => {
    vi.mocked(userAPI.createProfile).mockRejectedValueOnce(new Error('Nickname unavailable'));
    const onCompleted = vi.fn().mockResolvedValue(undefined);
    render(<CompleteRegistration onCompleted={onCompleted} />);
    const [nickname, visibleName] = screen.getAllByRole('textbox');
    fireEvent.change(nickname, { target: { value: 'misha' } });
    fireEvent.change(visibleName, { target: { value: 'Misha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать профиль' }));
    await waitFor(() => expect(screen.getByText('Не удалось создать или обновить профиль. Попробуйте ещё раз.')).toBeInTheDocument());
    expect(nickname).toHaveValue('misha');
    expect(visibleName).toHaveValue('Misha');
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('calls completion once after successful profile creation', async () => {
    vi.mocked(userAPI.createProfile).mockResolvedValueOnce({ id: 9, nickname: 'misha', visibleName: 'Misha', imageLink: null });
    const onCompleted = vi.fn().mockResolvedValue(undefined);
    render(<CompleteRegistration onCompleted={onCompleted} />);
    const [nickname, visibleName] = screen.getAllByRole('textbox');
    fireEvent.change(nickname, { target: { value: 'misha' } });
    fireEvent.change(visibleName, { target: { value: 'Misha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать профиль' }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));
    expect(userAPI.createProfile).toHaveBeenCalledTimes(1);
  });

  it('does not start profile creation without Hub authentication', () => {
    authState.authenticated = false;
    authState.userId = null;
    const onCompleted = vi.fn();
    render(<CompleteRegistration onCompleted={onCompleted} />);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Создать профиль' })).not.toBeInTheDocument();
    expect(userAPI.createProfile).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
  });
});
