import React from 'react';
import { Button, StatePanel } from '@tdn/shared';
import { CampaignApiError } from './api';

export const ApiError: React.FC<{ error: unknown; onRetry?: () => void }> = ({ error, onRetry }) => {
  const apiError = error instanceof CampaignApiError ? error : undefined;
  const status = apiError?.status;
  const message = apiError?.unknownOutcome || status === 0
    ? 'Результат операции неизвестен. Проверьте данные перед повторной попыткой.'
    : status === 400 ? 'Проверьте введённые данные.'
      : status === 401 ? 'Сессия завершена. Войдите снова.'
        : status === 403 ? 'Доступ запрещён.'
          : status === 404 ? 'Ресурс не найден.'
            : status === 409 ? 'Конфликт версии. Черновик сохранён; перечитайте данные перед повторным сохранением.'
              : status === 503 ? 'Зависимый сервис временно недоступен.'
                : status === 500 || status === 502 || status === 504 ? 'Сервис временно недоступен. Попробуйте позже.'
                  : 'Не удалось выполнить операцию. Попробуйте ещё раз.';
  return <StatePanel kind="error">{message}{onRetry && <Button variant="secondary" type="button" onClick={onRetry}>Повторить загрузку</Button>}</StatePanel>;
};
