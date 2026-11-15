import { normalizeKenyanPhone, phoneQueryVariants, toKenyanE164 } from '../src/utils/phone';

describe('KENYAN PHONE NORMALIZATION', () => {
  it.each([
    ['0712345678', '254712345678'],
    ['0112345678', '254112345678'],
    ['+254712345678', '254712345678'],
    ['254712345678', '254712345678'],
    ['00254712345678', '254712345678'],
    ['0712 345 678', '254712345678'],
    ['0712-345-678', '254712345678'],
    ['712345678', '254712345678'],
    ['2540712345678', '254712345678'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it('rejects invalid, short and non-Kenyan numbers', () => {
    expect(normalizeKenyanPhone('')).toBeNull();
    expect(normalizeKenyanPhone(null)).toBeNull();
    expect(normalizeKenyanPhone('12345')).toBeNull();
    expect(normalizeKenyanPhone('+15551234567')).toBeNull();
    expect(normalizeKenyanPhone('254612345678')).toBeNull();
  });

  it('builds legacy query variants including the original value', () => {
    const variants = phoneQueryVariants('0712345678');
    expect(variants).toEqual(expect.arrayContaining([
      '254712345678',
      '+254712345678',
      '0712345678',
      '712345678',
      '2540712345678',
    ]));
    expect(new Set(variants).size).toBe(variants.length);
  });

  it('formats E.164 for integrations', () => {
    expect(toKenyanE164('0712345678')).toBe('+254712345678');
    expect(toKenyanE164('bad')).toBeNull();
  });
});
