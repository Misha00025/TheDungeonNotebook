import React, { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { Field, Input } from '@tdn/shared';
import type { JsonNumber } from './types';
import type { CatalogMetadata } from './catalogTypes';
import { CampaignApiError } from './api';
import { validateCharacterQuantity } from './characterCatalogModel';
import type { CharacterQuantityIssue, CharacterQuantityPolicy } from './characterCatalogModel';

export type CharacterQuantityInputProps = {
  metadata: Pick<CatalogMetadata, 'kind' | 'quantityUnit' | 'allowNegative'>;
  raw: string;
  onRawChange: (raw: string) => void;
  onValidityChange?: (value: JsonNumber | null | undefined, issue?: CharacterQuantityIssue) => void;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  serverError?: unknown;
  label?: string;
};

const issueLabels: Record<CharacterQuantityIssue, string> = {
  required: 'Введите количество.',
  invalid_number: 'Введите корректное число.',
  whole_required: 'Для целой единицы количества нужно целое число.',
  negative_not_allowed: 'Отрицательное количество запрещено для этого предмета.',
  invalid_definition: 'Для предмета не задана единица количества.',
};

function serverErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof CampaignApiError) || error.status !== 400) return undefined;
  return 'Сервер не принял количество. Проверьте формат, единицу и допустимость отрицательного значения.';
}

export const CharacterQuantityInput: React.FC<CharacterQuantityInputProps> = ({
  metadata,
  raw,
  onRawChange,
  onValidityChange,
  required = true,
  disabled = false,
  readOnly = false,
  serverError,
  label = 'Количество',
}) => {
  const id = useId();
  const callbackRef = useRef(onValidityChange);
  const lastReported = useRef<string | undefined>(undefined);
  callbackRef.current = onValidityChange;

  const policy: CharacterQuantityPolicy = {
    kind: metadata.kind,
    quantityUnit: metadata.quantityUnit,
    allowNegative: metadata.allowNegative,
  };
  const validation = useMemo(
    () => validateCharacterQuantity(raw, policy, required),
    [raw, policy.kind, policy.quantityUnit, policy.allowNegative, required],
  );
  const policyKey = `${policy.kind}:${policy.quantityUnit ?? 'none'}:${policy.allowNegative}:${required}`;
  const report = useCallback((rawValue: string, result: ReturnType<typeof validateCharacterQuantity>) => {
    const valueKey = result.value === undefined ? 'undefined' : result.value === null ? 'null' : String(result.value);
    const signature = `${policyKey}:${rawValue}:${result.issue ?? ''}:${valueKey}`;
    if (lastReported.current === signature) return;
    lastReported.current = signature;
    callbackRef.current?.(result.value, result.issue);
  }, [policyKey]);

  useEffect(() => {
    report(raw, validation);
  }, [raw, validation, report]);

  if (metadata.kind === 'Skill') return null;
  if (metadata.quantityUnit === 'Single') {
    return <Field label={label} htmlFor={`${id}-single`}>
      <output id={`${id}-single`} aria-label={label}>1</output>
    </Field>;
  }

  const error = validation.issue ? issueLabels[validation.issue] : serverErrorMessage(serverError);
  const changeRaw = (value: string) => {
    onRawChange(value);
    report(value, validateCharacterQuantity(value, policy, required));
  };

  return <Field label={label} htmlFor={id} error={error}>
    {readOnly
      ? <output id={id} aria-label={label}>{raw || '—'}</output>
      : <Input
        id={id}
        inputMode="decimal"
        value={raw}
        disabled={disabled}
        aria-invalid={Boolean(validation.issue) || undefined}
        onChange={event => changeRaw(event.target.value)}
      />}
  </Field>;
};

export default CharacterQuantityInput;
