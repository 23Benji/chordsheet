import { TestBed } from '@angular/core/testing';
import { anchorFor } from '../core/anchoring';
import { parseChordPro } from '../core/chordpro';
import { Annotation } from '../core/models';
import { DB } from '../data/db';
import { AnnotationService } from './annotation.service';

/** In-memory stand-in for the Dexie annotations table. */
function fakeDb() {
  const rows = new Map<string, Annotation>();
  return {
    rows,
    annotations: {
      toArray: async () => [...rows.values()],
      put: async (a: Annotation) => void rows.set(a.id, a),
      bulkPut: async (list: Annotation[]) => list.forEach((a) => rows.set(a.id, a)),
      delete: async (id: string) => void rows.delete(id),
    },
  };
}

describe('AnnotationService', () => {
  it('adds, updates, removes and re-anchors a song’s notes (persisted)', async () => {
    const db = fakeDb();
    TestBed.configureTestingModule({ providers: [{ provide: DB, useValue: db }] });
    const service = TestBed.inject(AnnotationService);
    const sheet = parseChordPro('[C]UNO\nDUE\nTRE');

    const note = await service.add({ songId: 's', type: 'note', text: 'piano', anchor: anchorFor(sheet, 1) });
    await service.add({ songId: 's', type: 'highlight', text: '', color: 'sky', anchor: anchorFor(sheet, 2) });
    expect(service.forSong('s').length).toBe(2);
    expect(service.songsWithNotes().has('s')).toBe(true);

    await service.update(note, { text: 'forte' });
    expect(db.rows.get(note.id)?.text).toBe('forte');

    // "DUE" moves down, "TRE" disappears: 1 note follows, 1 becomes orphaned.
    const orphans = await service.reanchorSong('s', parseChordPro('ZERO\n[C]UNO\nDUE'));
    expect(orphans).toBe(1);
    const [moved, lost] = service.forSong('s');
    expect(moved.anchor.lineIndex).toBe(2);
    expect(lost.orphaned).toBe(true);
    expect(db.rows.get(lost.id)?.orphaned).toBe(true);

    await service.remove(lost.id);
    expect(service.forSong('s').length).toBe(1);
    expect(db.rows.size).toBe(1);
  });
});
