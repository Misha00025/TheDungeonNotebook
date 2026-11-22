import { describe, expect, it } from 'vitest';
import { isLosslessNumber } from 'lossless-json';
import { validateCharacterQuantity } from './characterCatalogModel';
import type { CharacterQuantityIssue, CharacterQuantityPolicy } from './characterCatalogModel';

const whole: CharacterQuantityPolicy = { kind: 'Item', quantityUnit: 'Whole', allowNegative: false };
const quantityCases: { name: string; raw: string; policy: CharacterQuantityPolicy; expected?: string | null; issue?: CharacterQuantityIssue; lossless?: boolean }[] = [
  { name: 'keeps very large whole quantities exact', raw: '900719925474099312345', policy: whole, expected: '900719925474099312345' },
  { name: 'accepts decimal notation for an integer', raw: '1.0', policy: whole, expected: '1.0' },
  { name: 'rejects non-integral whole quantities', raw: '1.25', policy: whole, issue: 'whole_required' },
  { name: 'keeps fractional quantities exact', raw: '0.125', policy: { ...whole, quantityUnit: 'Fractional' }, expected: '0.125' },
  { name: 'rejects negative quantities when disallowed', raw: '-2', policy: whole, issue: 'negative_not_allowed' },
  { name: 'accepts negative quantities when allowed', raw: '-2', policy: { ...whole, allowNegative: true }, expected: '-2' },
  { name: 'retains zero as a quantity', raw: '0', policy: whole, expected: '0' },
  { name: 'uses one for single-unit items', raw: '17', policy: { ...whole, quantityUnit: 'Single' }, expected: '1', lossless: false },
  { name: 'uses null quantity for skills', raw: '', policy: { kind: 'Skill', quantityUnit: null, allowNegative: false }, expected: null },
];

describe('character catalog quantity validation', () => {
  it.each(quantityCases)('$name', ({ raw, policy, expected, issue, lossless = true }) => {
    const result = validateCharacterQuantity(raw, policy);
    expect(result.issue).toBe(issue);
    if (expected === undefined) expect(result.value).toBeUndefined();
    else if (expected === null) expect(result.value).toBeNull();
    else {
      expect(String(result.value)).toBe(expected);
      if (lossless) expect(isLosslessNumber(result.value)).toBe(true);
    }
  });
});
