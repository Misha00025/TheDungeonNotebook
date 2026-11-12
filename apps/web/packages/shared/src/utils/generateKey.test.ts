import { generateKey } from './generateKey';

describe('generateKey', () => {
  it('converts spaces to underscores', () => {
    expect(generateKey('My Field')).toBe('my_field');
  });

  it('converts multiple spaces to a single underscore (regex \\s+ collapses them)', () => {
    expect(generateKey('Hello   World')).toBe('hello_world');
  });

  it('lowercases the string', () => {
    expect(generateKey('UPPERCASE')).toBe('uppercase');
  });

  it('removes special characters', () => {
    expect(generateKey('hello!@#world')).toBe('helloworld');
  });

  it('handles Russian text', () => {
    expect(generateKey('Привет Мир')).toBe('привет_мир');
  });

  it('handles empty string', () => {
    expect(generateKey('')).toBe('');
  });

  it('preserves digits', () => {
    expect(generateKey('Field 123')).toBe('field_123');
  });

  it('handles single word', () => {
    expect(generateKey('Name')).toBe('name');
  });
});
