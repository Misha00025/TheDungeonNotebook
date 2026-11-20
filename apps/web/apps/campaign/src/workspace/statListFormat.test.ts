import { describe, expect, it } from 'vitest';
import { LosslessNumber } from 'lossless-json';
import { compileStatListCondition, compileStatListFormat } from './statListFormat';

describe('stat-list format', () => {
  it('formats shared expressions and stable expression slots', () => {
    const format = compileStatListFormat('$0 (${1:s})', ['floor(($0 - 10) / 2)']);
    expect(format.render(16)).toEqual({ text: '16 (+3)' });
    expect(format.render(9)).toEqual({ text: '9 (-1)' });
    expect(format.render(10)).toEqual({ text: '10 (+0)' });
    expect(compileStatListFormat('$0 / $2', ['floor(($0 - 10) / 2)', '$0 * 2']).render(16)).toEqual({ text: '16 / 32' });
  });

  it('preserves lossless input and expression literal precision', () => {
    const format = compileStatListFormat('$0|$1', ['$0 + 1']);
    expect(format.render(new LosslessNumber('9007199254740993'))).toEqual({ text: '9007199254740993|9007199254740994' });
    expect(compileStatListFormat('$1', ['9007199254740993 + $0']).render(1)).toEqual({ text: '9007199254740994' });
  });

  it('reports unsupported and invalid arithmetic instead of returning a number', () => {
    expect(compileStatListFormat('$1', ['globalThis.alert(1)']).render(1)).toEqual({ error: expect.any(String) });
    expect(compileStatListFormat('$1', ['$0 / 0']).render(1)).toEqual({ error: expect.any(String) });
  });

  it('filters values without hiding them on invalid conditions', () => {
    const condition = compileStatListCondition('$0 > 0');
    expect(condition.test(3)).toEqual({ matches: true });
    expect(condition.test(0)).toEqual({ matches: false });
    expect(compileStatListCondition('$0 > 9007199254740992').test(new LosslessNumber('9007199254740993'))).toEqual({ matches: true });
    expect(condition.test('текст')).toEqual({ matches: true, error: expect.any(String) });
    expect(compileStatListCondition('$0 >').test(0)).toEqual({ matches: true, error: expect.any(String) });
  });
});
