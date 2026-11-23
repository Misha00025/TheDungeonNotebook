import { isNumber, LosslessNumber, splitNumber } from 'lossless-json';
import type { JsonNumber } from './types';
import type { CatalogKind, QuantityUnit } from './catalogTypes';

export type CharacterQuantityPolicy = {
  kind: CatalogKind;
  quantityUnit: QuantityUnit | null;
  allowNegative: boolean;
};

export function supportsCharacterAttributes(policy: Pick<CharacterQuantityPolicy, 'kind' | 'quantityUnit'>): boolean {
  return policy.kind === 'Skill' || policy.quantityUnit === 'Single';
}

export type CharacterQuantityIssue = 'required' | 'invalid_number' | 'whole_required' | 'negative_not_allowed' | 'invalid_definition';

export type CharacterQuantityValidation = {
  value: JsonNumber | null | undefined;
  issue?: CharacterQuantityIssue;
};

export function isMathematicalInteger(value: string): boolean {
  if (!isNumber(value)) return false;
  const split = splitNumber(value);
  return split.digits === '0' || split.exponent >= split.digits.length - 1;
}

export function validateCharacterQuantity(
  raw: string,
  policy: CharacterQuantityPolicy,
  required = true,
): CharacterQuantityValidation {
  if (policy.kind === 'Skill') return { value: null };
  if (policy.quantityUnit === null) return { value: undefined, issue: 'invalid_definition' };
  if (policy.quantityUnit === 'Single') return { value: 1 };
  if (raw.length === 0) return required
    ? { value: undefined, issue: 'required' }
    : { value: null };
  if (!isNumber(raw)) return { value: undefined, issue: 'invalid_number' };
  if (policy.quantityUnit === 'Whole' && !isMathematicalInteger(raw)) {
    return { value: undefined, issue: 'whole_required' };
  }
  if (!policy.allowNegative) {
    const split = splitNumber(raw);
    if (split.sign === '-' && split.digits !== '0') {
      return { value: undefined, issue: 'negative_not_allowed' };
    }
  }
  return { value: new LosslessNumber(raw) };
}

export function characterQuantityToRaw(value: JsonNumber | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}
