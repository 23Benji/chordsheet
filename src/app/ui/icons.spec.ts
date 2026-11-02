import { ICONS, IconNode } from './icons';

const REQUIRED: Record<string, string[]> = {
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  rect: ['width', 'height'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
};

describe('icons', () => {
  it('every icon has shapes with all their geometry attributes', () => {
    for (const [name, nodes] of Object.entries(ICONS) as [string, IconNode[]][]) {
      expect(nodes.length, name).toBeGreaterThan(0);
      for (const [tag, attrs] of nodes) {
        for (const attr of REQUIRED[tag]) expect(attrs[attr], `${name} <${tag}> ${attr}`).toBeDefined();
      }
    }
  });
});
