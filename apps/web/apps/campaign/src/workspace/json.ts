import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json';
import type { JsonValue } from './types';

export function parseJson(text: string): JsonValue {
  return parse(text, undefined, token => {
    if (/^-?(0|[1-9]\d*)$/.test(token) && Number.isSafeInteger(Number(token))) return Number(token);
    return new LosslessNumber(token);
  }) as JsonValue;
}

export function stringifyJson(value: unknown, space?: string | number): string {
  return stringify(value, undefined, space) as string;
}

export function displayValue(value: JsonValue): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || isLosslessNumber(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  return stringifyJson(value);
}
