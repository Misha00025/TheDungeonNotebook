import React, { useEffect, useRef, useState } from 'react';
import { isLosslessNumber, LosslessNumber } from 'lossless-json';
import type { ChoiceOption, JsonValue, ValueType } from './types';
import { displayValue } from './json';
import { Input, Select, Textarea } from '@tdn/shared';
import styles from './ValueInput.module.css';

type Field = { valueType: ValueType; options: ChoiceOption[] };
const intPattern = /^-?(?:0|[1-9]\d*)$/;
const numberPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const rawNumber = (value: JsonValue) => typeof value === 'number' || isLosslessNumber(value) ? String(value) : '';
const isIntegerValue = (value: JsonValue) => typeof value === 'number' ? Number.isInteger(value) : isLosslessNumber(value) && intPattern.test(String(value));
const toExactInteger = (token: string): bigint | undefined => {
  if (!intPattern.test(token)) return undefined;
  const negative = token.startsWith('-');
  const digits = token.replace(/^-/, '').replace(/^0+(?=\d)/, '');
  return BigInt(`${negative ? '-' : ''}${digits}`);
};
export function parseFieldValue(field: Field, raw: string): JsonValue {
  if (field.valueType === 'String') return raw;
  if (field.valueType === 'Boolean') return raw === 'true';
  if (field.valueType === 'SingleChoice') return raw;
  if (field.valueType === 'MultiChoice') return raw ? raw.split('\u001f') : [];
  if (field.valueType === 'Integer' || field.valueType === 'Number') return new LosslessNumber(raw);
  return null;
}
export function validateFieldValue(field: Field, value: JsonValue, raw?: string): string | undefined {
  switch (field.valueType) {
    case 'Integer': {
      const token = raw ?? rawNumber(value);
      if (!intPattern.test(token)) return 'Введите целое число.';
      const integer = toExactInteger(token);
      if (integer === undefined) return 'Введите целое число.';
      if (integer < -9223372036854775808n || integer > 9223372036854775807n) return 'Значение вне диапазона int64.';
      return isIntegerValue(value) ? undefined : 'Введите целое число.';
    }
    case 'Number': {
      const token = raw ?? rawNumber(value);
      return numberPattern.test(token) && Number.isFinite(Number(token)) && (typeof value === 'number' || isLosslessNumber(value)) ? undefined : 'Введите конечное число.';
    }
    case 'String': return typeof value === 'string' ? undefined : 'Ожидается строка.';
    case 'Boolean': return typeof value === 'boolean' ? undefined : 'Ожидается логическое значение.';
    case 'SingleChoice': return typeof value === 'string' && field.options.some(option => option.optionKey === value) ? undefined : 'Выберите существующий вариант.';
    case 'MultiChoice': return Array.isArray(value) && value.every(item => typeof item === 'string' && field.options.some(option => option.optionKey === item)) && new Set(value).size === value.length ? undefined : 'Выберите существующие варианты без повторов.';
  }
}

export const ValueInput: React.FC<{ field: Field; value: JsonValue; onChange: (value: JsonValue) => void; onValidityChange?: (error: string | undefined) => void; disabled?: boolean; label?: string; compact?: boolean; inline?: boolean; controlledNumericDraft?: string; onRawChange?: (raw: string) => void }> = ({ field, value, onChange, onValidityChange, disabled = false, label, compact = false, inline = false, controlledNumericDraft, onRawChange }) => {
  const numeric = field.valueType === 'Integer' || field.valueType === 'Number';
  const [localDraft, setLocalDraft] = useState(() => numeric ? rawNumber(value) : '');
  const draft = controlledNumericDraft ?? localDraft;
  const validityCallback = useRef(onValidityChange);
  validityCallback.current = onValidityChange;
  useEffect(() => { if (numeric && controlledNumericDraft === undefined) setLocalDraft(rawNumber(value)); }, [numeric, value, controlledNumericDraft]);
  const error = validateFieldValue(field, value, numeric ? draft : undefined);
  useEffect(() => { validityCallback.current?.(error); }, [error]);
  if (disabled) return <output aria-label={label}>{displayValue(value)}</output>;
  if (field.valueType === 'String') return <Textarea className={inline ? styles.compactControl : undefined} aria-label={label} rows={compact ? 1 : undefined} style={compact && !inline ? { minHeight: '2.5rem' } : undefined} value={typeof value === 'string' ? value : ''} onChange={event => onChange(event.target.value)} />;
  if (field.valueType === 'Boolean') return <input aria-label={label} type="checkbox" checked={value === true} onChange={event => onChange(event.target.checked)} />;
  if (field.valueType === 'SingleChoice') return <Select className={inline ? styles.compactControl : undefined} aria-label={label} value={typeof value === 'string' ? value : ''} onChange={event => onChange(event.target.value)}><option value="">Выберите вариант</option>{field.options.map(option => <option key={option.optionKey} value={option.optionKey}>{option.title}</option>)}</Select>;
  if (field.valueType === 'MultiChoice') {
    const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
    return <fieldset className={inline ? styles.compactChoices : undefined} aria-label={label}>{field.options.map(option => <label key={option.optionKey}><input type="checkbox" checked={selected.includes(option.optionKey)} onChange={event => onChange(event.target.checked ? [...new Set([...selected, option.optionKey])] : selected.filter(item => item !== option.optionKey))} />{option.title}</label>)}</fieldset>;
  }
  return <div className={inline ? styles.compactNumeric : undefined}><Input className={inline ? styles.compactControl : undefined} aria-label={label} inputMode="decimal" value={draft} onChange={event => { const next = event.target.value; if (controlledNumericDraft === undefined) setLocalDraft(next); onRawChange?.(next); try { const parsed = parseFieldValue(field, next); const issue = validateFieldValue(field, parsed, next); validityCallback.current?.(issue); if (!issue) onChange(parsed); } catch { validityCallback.current?.(field.valueType === 'Integer' ? 'Введите целое число.' : 'Введите конечное число.'); } }} />{error && <span role="alert">{error}</span>}</div>;
};
