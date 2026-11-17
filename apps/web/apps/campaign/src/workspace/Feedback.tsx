import React from 'react';
import { CampaignApiError } from './api';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';

export const ApiError: React.FC<{ error: unknown; onRetry?: () => void }> = ({ error, onRetry }) => {
  const apiError = error instanceof CampaignApiError ? error : undefined;
  const status = apiError?.status;
  const message = apiError?.unknownOutcome || status === 0
    ? 'Результат операции неизвестен. Проверьте данные перед повторной попыткой.'
    : status === 403 ? 'Доступ запрещён.'
      : status === 404 ? 'Ресурс не найден.'
        : status === 409 ? 'Конфликт версии. Черновик сохранён; перечитайте данные перед повторным сохранением.'
          : status === 503 ? 'Зависимый сервис временно недоступен.'
            : apiError?.problem.detail || (error instanceof Error ? error.message : String(error));
  return <section className={commonStyles.card} role="alert"><p>{message}</p>{apiError?.problem.code && <p>Код: {apiError.problem.code}</p>}{apiError?.problem.detail && <p>{apiError.problem.detail}</p>}{apiError?.problem.errors && <ul>{Object.entries(apiError.problem.errors).flatMap(([field, errors]) => errors.map((item, index) => <li key={`${field}-${index}`}>{field}: {item}</li>))}</ul>}{status === 400 && <p>Проверьте поля формы.</p>}{onRetry && <button className={buttonStyles.button} onClick={onRetry}>Повторить загрузку</button>}</section>;
};
