import {
  columnHalfCount,
  columnHalfOffset,
  columnPageCount,
  columnPageOffset,
  secondsPerScreenFromTempo,
  verticalPageAt,
  verticalPageCount,
  verticalPageOffset,
} from './paging';

describe('paging', () => {
  it('counts column pages (two columns per page)', () => {
    // width 1000, gap 50 → columns of 475; 1, 1.5 and 2 pages of content.
    expect(columnPageCount(1000, 1000, 50)).toBe(1);
    expect(columnPageCount(1000 + 50 + 475, 1000, 50)).toBe(2);
    expect(columnPageCount(2050, 1000, 50)).toBe(2);
    expect(columnPageCount(0, 0, 0)).toBe(1);
    expect(columnPageOffset(2, 1000, 50)).toBe(2100);
  });

  it('counts vertical screens with a little overlap', () => {
    expect(verticalPageCount(800, 800)).toBe(1);
    expect(verticalPageCount(1400, 800)).toBe(2); // 600 more px < one stride of 680
    expect(verticalPageCount(1600, 800)).toBe(3);
    expect(verticalPageOffset(1, 1600, 800)).toBe(680);
    expect(verticalPageOffset(2, 1600, 800)).toBe(800); // never past the end
    expect(verticalPageAt(800, 1600, 800)).toBe(2);
    expect(verticalPageAt(300, 1600, 800)).toBe(0);
  });

  it('half-page turns over columns: one column per turn, the last view shows the last two', () => {
    // width 1000, gap 50 → columns of 475, one column stride = 525.
    expect(columnHalfCount(1000, 1000, 50)).toBe(1); // 2 columns: nothing to turn
    expect(columnHalfCount(1000 + 50 + 475, 1000, 50)).toBe(2); // 3 columns: [1 2] → [2 3]
    expect(columnHalfCount(2050, 1000, 50)).toBe(3); // 4 columns: [1 2] → [2 3] → [3 4]
    expect(columnHalfCount(0, 0, 0)).toBe(1);
    expect(columnHalfOffset(1, 1000, 50)).toBe(525);
    // The last position is exactly where the box can scroll to.
    expect(columnHalfOffset(columnHalfCount(2050, 1000, 50) - 1, 1000, 50)).toBe(2050 - 1000);
  });

  it('half-page turns vertically: half a screen per turn', () => {
    expect(verticalPageCount(1600, 800, 0.5)).toBe(3); // 0 → 400 → 800
    expect(verticalPageOffset(1, 1600, 800, 0.5)).toBe(400);
    expect(verticalPageAt(400, 1600, 800, 0.5)).toBe(1);
  });

  it('estimates auto-scroll speed from the tempo', () => {
    expect(secondsPerScreenFromTempo(120)).toBe(32);
    expect(secondsPerScreenFromTempo(10)).toBe(180); // clamped
  });
});
