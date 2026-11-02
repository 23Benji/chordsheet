import { choFileName } from './export';

describe('choFileName', () => {
  it('follows the bundled file pattern', () => {
    expect(choFileName({ number: 4, suffix: 'b', title: 'Siam riuniti tutti qui' })).toBe(
      '004b - Siam riuniti tutti qui.cho',
    );
    expect(choFileName({ number: null, suffix: '', title: 'Nuovo: canto?' })).toBe('Nuovo canto.cho');
  });
});
