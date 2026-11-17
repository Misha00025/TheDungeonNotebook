import { describe, expect, it } from 'vitest';
import { displayValue, parseJson, stringifyJson } from './json';
import { isLosslessNumber } from 'lossless-json';

describe('workspace JSON', () => {
  it('parses safe integer tokens as numbers and preserves other numeric tokens', () => {
    const value = parseJson('{"safe":42,"large":9223372036854775807,"decimal":1.2300,"exp":1e30}') as Record<string, any>;
    expect(value.safe).toBe(42);
    expect(isLosslessNumber(value.large)).toBe(true);
    expect(isLosslessNumber(value.decimal)).toBe(true);
    expect(isLosslessNumber(value.exp)).toBe(true);
    expect(stringifyJson(value)).toContain('9223372036854775807');
  });

  it('keeps false, zero, empty strings and nested parameters native', () => {
    const value = parseJson('{"a":false,"b":0,"c":"","params":{"n":0.1234567890123456789}}') as Record<string, any>;
    expect(value).toMatchObject({ a: false, b: 0, c: '' });
    expect(stringifyJson(value)).toContain('0.1234567890123456789');
  });

  it('displays scalar and composite values appropriately', () => {
    expect(displayValue('text')).toBe('text');
    expect(displayValue(false)).toBe('false');
    expect(displayValue(0)).toBe('0');
    expect(displayValue(parseJson('{"n":1}') as any)).toBe('{"n":1}');
  });
});
