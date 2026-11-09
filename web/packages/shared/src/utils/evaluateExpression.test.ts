import { evaluateExpression } from './evaluateExpression';

describe('evaluateExpression', () => {
  it('returns NaN for empty string', () => {
    expect(evaluateExpression('')).toBeNaN();
  });

  it('returns NaN for null', () => {
    expect(evaluateExpression(null as unknown as string)).toBeNaN();
  });

  it('returns NaN for undefined', () => {
    expect(evaluateExpression(undefined as unknown as string)).toBeNaN();
  });

  it('returns NaN for whitespace-only string', () => {
    expect(evaluateExpression('   ')).toBeNaN();
  });

  it('returns NaN for invalid characters', () => {
    expect(evaluateExpression('abc')).toBeNaN();
  });

  it('evaluates simple addition', () => {
    expect(evaluateExpression('2 + 3')).toBe(5);
  });

  it('evaluates subtraction', () => {
    expect(evaluateExpression('10 - 4')).toBe(6);
  });

  it('evaluates multiplication', () => {
    expect(evaluateExpression('3 * 7')).toBe(21);
  });

  it('evaluates division', () => {
    expect(evaluateExpression('10 / 2')).toBe(5);
  });

  it('evaluates modulo', () => {
    expect(evaluateExpression('10 % 3')).toBe(1);
  });

  it('evaluates power operator', () => {
    expect(evaluateExpression('2 ^ 3')).toBe(8);
  });

  it('respects operator precedence', () => {
    expect(evaluateExpression('2 + 3 * 4')).toBe(14);
  });

  it('handles parentheses', () => {
    expect(evaluateExpression('(2 + 3) * 4')).toBe(20);
  });

  it('returns a pure number as-is', () => {
    expect(evaluateExpression('42')).toBe(42);
  });

  it('handles decimal numbers', () => {
    expect(evaluateExpression('3.5 + 2.5')).toBe(6);
  });

  it('handles division by zero (returns Infinity)', () => {
    expect(evaluateExpression('1 / 0')).toBe(Infinity);
  });
});
