import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './Feedback';
import { CampaignApiError } from './api';

describe('ApiError', () => {
  it.each([
    [new CampaignApiError(400, { code: 'invalid', title: 'Bad request', detail: 'raw detail', errors: { secretField: ['bad value'] } }), 'Проверьте введённые данные.'],
    [new CampaignApiError(401, { code: 'unauthorized', title: 'Unauthorized', detail: 'raw detail' }), 'Сессия завершена. Войдите снова.'],
    [new CampaignApiError(403, { code: 'forbidden', title: 'Forbidden', detail: 'raw detail' }), 'Доступ запрещён.'],
    [new CampaignApiError(404, { code: 'missing', title: 'Missing', detail: 'raw detail' }), 'Ресурс не найден.'],
    [new CampaignApiError(409, { code: 'conflict', title: 'Conflict', detail: 'raw detail' }), 'Конфликт версии. Черновик сохранён; перечитайте данные перед повторным сохранением.'],
    [new CampaignApiError(503, { code: 'dependency', title: 'Unavailable', detail: 'raw detail' }), 'Зависимый сервис временно недоступен.'],
    [new CampaignApiError(500, { code: 'internal', title: 'Internal', detail: 'raw detail' }), 'Сервис временно недоступен. Попробуйте позже.'],
    [new CampaignApiError(502, { code: 'gateway', title: 'Gateway', detail: 'raw detail' }), 'Сервис временно недоступен. Попробуйте позже.'],
    [new CampaignApiError(504, { code: 'timeout', title: 'Timeout', detail: 'raw detail' }), 'Сервис временно недоступен. Попробуйте позже.'],
    [new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown', detail: 'raw detail' }), 'Результат операции неизвестен. Проверьте данные перед повторной попыткой.'],
    [new Error('raw error message'), 'Не удалось выполнить операцию. Попробуйте ещё раз.']
  ])('shows stable user-facing text for status errors', (error, message) => {
    render(<ApiError error={error} />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw detail');
    expect(document.body.textContent).not.toContain('raw error message');
    expect(document.body.textContent).not.toContain('secretField');
    expect(document.body.textContent).not.toContain('invalid');
  });

  it('shows unknown outcome text without leaking payload details and preserves retry', () => {
    const retry = vi.fn();
    render(<ApiError error={new CampaignApiError(503, { code: 'private_code', title: 'Private title', detail: 'private detail' }, true)} onRetry={retry} />);
    expect(screen.getByText('Результат операции неизвестен. Проверьте данные перед повторной попыткой.')).toBeInTheDocument();
    expect(screen.queryByText(/private|Код:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps retry outside expiring notification and restarts only for a new error instance', () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    const first = new CampaignApiError(400, { code: 'invalid', title: 'Bad request', detail: 'private' });
    const view = render(<ApiError error={first} onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Проверьте введённые данные.');
    const button = screen.getByRole('button', { name: 'Повторить загрузку' });
    act(() => vi.advanceTimersByTime(400));
    view.rerender(<ApiError error={first} onRetry={retry} />);
    act(() => vi.advanceTimersByTime(5600));
    expect(screen.queryByText('Проверьте введённые данные.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Повторить загрузку' })).toBe(button);
    expect(retry).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(1);

    const uncertain = new CampaignApiError(409, { code: 'conflict', title: 'Conflict', detail: 'private detail' }, true);
    view.rerender(<ApiError error={uncertain} onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Результат операции неизвестен. Проверьте данные перед повторной попыткой.');
    expect(screen.queryByText(/private/)).toBeNull();
    act(() => vi.advanceTimersByTime(5000));
    view.rerender(<ApiError error={new CampaignApiError(409, { code: 'conflict', title: 'Conflict', detail: 'private detail' }, true)} onRetry={retry} />);
    act(() => vi.advanceTimersByTime(5999));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('alert')).toBeNull();
    view.unmount();
    vi.useRealTimers();
  });
});
