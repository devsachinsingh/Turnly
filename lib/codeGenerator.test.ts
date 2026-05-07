import { describe, it, expect } from 'vitest';
import { generateGroupCode, validateGroupCode } from './codeGenerator';

describe('generateGroupCode', () => {
  it('returns a 6-character string', () => {
    expect(generateGroupCode()).toHaveLength(6);
  });

  it('returns only uppercase alphanumeric characters', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateGroupCode()).toMatch(/^[A-Z0-9]{6}$/);
    }
  });

  it('generates unique codes across many calls', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateGroupCode()));
    expect(codes.size).toBeGreaterThan(90);
  });
});

describe('validateGroupCode', () => {
  it('accepts valid 6-char alphanumeric codes', () => {
    expect(validateGroupCode('ABC123')).toBe(true);
    expect(validateGroupCode('ZZZZZZ')).toBe(true);
    expect(validateGroupCode('000000')).toBe(true);
  });

  it('accepts lowercase input (normalised internally)', () => {
    expect(validateGroupCode('abc123')).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(validateGroupCode('ABC12')).toBe(false);
    expect(validateGroupCode('ABC1234')).toBe(false);
    expect(validateGroupCode('')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(validateGroupCode('ABC!23')).toBe(false);
    expect(validateGroupCode('AB C12')).toBe(false);
  });
});
