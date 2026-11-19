import React from 'react';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Profile from './Profile';

const state = vi.hoisted(() => ({
  profile: { id: 12, nickname: 'player', visibleName: 'Player', imageLink: '' },
  loading: false,
  error: null as unknown,
  fetchProfile: vi.fn(),
  updateProfile: vi.fn(),
  uploadImage: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@tdn/shared/auth/useProfile', () => ({
  useProfile: () => ({ profile: state.profile, loading: state.loading, error: state.error, fetchProfile: state.fetchProfile }),
}));
vi.mock('@tdn/shared/auth/AuthContext', async importOriginal => {
  const actual = await importOriginal<typeof import('@tdn/shared/auth/AuthContext')>();
  return { ...actual, useAuth: () => ({ logout: state.logout }) };
});
vi.mock('@tdn/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@tdn/shared')>();
  return { ...actual, userAPI: { ...actual.userAPI, updateProfile: state.updateProfile } };
});
vi.mock('../services/api', () => ({ uploadAPI: { uploadImage: state.uploadImage } }));

describe('Profile', () => {
  beforeEach(() => {
    state.profile = { id: 12, nickname: 'player', visibleName: 'Player', imageLink: '' };
    state.loading = false;
    state.error = null;
    state.fetchProfile.mockReset().mockResolvedValue(undefined);
    state.updateProfile.mockReset();
    state.uploadImage.mockReset();
    state.logout.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows validation warnings for unsupported and oversized files without alert or upload', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<Profile />);
    fireEvent.click(screen.getByRole('button', { name: 'Редактировать профиль' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['text'], 'file.txt', { type: 'text/plain' })] } });
    expect(screen.getByText('Недопустимый формат файла. Разрешены: JPEG, PNG, GIF, BMP, WebP.')).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })] } });
    expect(screen.getByText('Файл слишком большой. Максимальный размер: 5MB.')).toBeInTheDocument();
    expect(state.uploadImage).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it('shows upload failure and retains the current form values', async () => {
    state.uploadImage.mockRejectedValue(new Error('private upload details'));
    render(<Profile />);
    fireEvent.click(screen.getByRole('button', { name: 'Редактировать профиль' }));
    fireEvent.change(screen.getByLabelText('Видимое имя:'), { target: { value: 'Draft name' } });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [new File(['image'], 'image.png', { type: 'image/png' })] } });
    expect(await screen.findByText('Ошибка загрузки изображения')).toBeInTheDocument();
    expect(screen.getByLabelText('Видимое имя:')).toHaveValue('Draft name');
    expect(document.body.textContent).not.toContain('private upload details');
  });

  it('shows save failure, retains draft, and reopens a repeated event after manual dismissal', async () => {
    state.updateProfile.mockRejectedValue(new Error('private save details'));
    render(<Profile />);
    fireEvent.click(screen.getByRole('button', { name: 'Редактировать профиль' }));
    fireEvent.change(screen.getByLabelText('Видимое имя:'), { target: { value: 'Draft name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText('Ошибка сохранения профиля')).toBeInTheDocument();
    expect(screen.getByLabelText('Видимое имя:')).toHaveValue('Draft name');
    fireEvent.click(within(screen.getByRole('region', { name: 'Уведомления' })).getByRole('button', { name: 'Закрыть уведомление' }));
    expect(screen.queryByText('Ошибка сохранения профиля')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText('Ошибка сохранения профиля')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('private save details');
  });

  it('does not clear the draft or repeat the save when an error notification expires', async () => {
    vi.useFakeTimers();
    state.updateProfile.mockRejectedValue(new Error('private save details'));
    render(<Profile />);
    fireEvent.click(screen.getByRole('button', { name: 'Редактировать профиль' }));
    fireEvent.change(screen.getByLabelText('Видимое имя:'), { target: { value: 'Retained draft' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('Ошибка сохранения профиля')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByText('Ошибка сохранения профиля')).toBeNull();
    expect(screen.getByLabelText('Видимое имя:')).toHaveValue('Retained draft');
    expect(state.updateProfile).toHaveBeenCalledTimes(1);
  });

  it('saves the exact profile payload and confirms success accessibly', async () => {
    state.updateProfile.mockResolvedValue(undefined);
    state.fetchProfile.mockResolvedValue(undefined);
    state.uploadImage.mockResolvedValue({ url: 'https://example.test/avatar.png', fileName: 'avatar.png', size: 5 });
    render(<Profile />);
    fireEvent.click(screen.getByRole('button', { name: 'Редактировать профиль' }));
    fireEvent.change(screen.getByLabelText('Видимое имя:'), { target: { value: 'Updated' } });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [new File(['image'], 'avatar.png', { type: 'image/png' })] } });
    await waitFor(() => expect(state.uploadImage).toHaveBeenCalledTimes(1));
    const save = screen.getByRole('button', { name: 'Сохранить' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(state.updateProfile).toHaveBeenCalledWith(12, { visibleName: 'Updated', imageLink: 'https://example.test/avatar.png' }));
    expect(state.fetchProfile).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toHaveTextContent('Профиль сохранён.');
  });

  it('keeps profile retry available after generic load error expires without automatic retry', () => {
    vi.useFakeTimers();
    state.error = new Error('private fetch details');
    const view = render(<Profile />);
    expect(screen.getByText('Не удалось загрузить профиль. Попробуйте ещё раз.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('private fetch details');
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByText('Не удалось загрузить профиль. Попробуйте ещё раз.')).toBeNull();
    expect(state.fetchProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
    expect(state.fetchProfile).toHaveBeenCalledTimes(1);
    view.unmount();
  });
});
