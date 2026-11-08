import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LayoutService } from '../../services/layout.service';
import { LibraryService } from '../../services/library.service';
import { RecentService } from '../../services/recent.service';
import { Home } from './home';

function setup(recentIds: string[], sidebarOpen = true) {
  const songs = ['a', 'b', 'c', 'd', 'e'].map((id, i) => [id, { id, title: `Canto ${id}`, number: `${i + 1}`, key: 'G' }] as const);
  TestBed.configureTestingModule({
    imports: [Home],
    providers: [
      provideRouter([]),
      { provide: LibraryService, useValue: { byId: signal(new Map(songs)) } },
      { provide: RecentService, useValue: { ids: signal(recentIds) } },
      { provide: LayoutService, useValue: { sidebarOpen: signal(sidebarOpen), introPlaying: signal(false), toggleSidebar: () => undefined } },
    ],
  });
  const fixture = TestBed.createComponent(Home);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Home', () => {
  it('follows the theme: it must not force its own (that made the title unreadable)', () => {
    expect(setup([]).getAttribute('data-theme')).toBeNull();
  });

  it('reads as one title, with the chords above it hidden from screen readers', () => {
    const el = setup([]);
    const h1 = el.querySelector('h1')!;
    h1.querySelectorAll('[aria-hidden="true"]').forEach((chord) => chord.remove());
    expect(h1.textContent).toBe('Scegli un canto');
  });

  it('with no recent songs, says where to search', () => {
    const el = setup([]);
    expect(el.querySelector('.recents')).toBeNull();
    expect(el.querySelector('.hint')?.textContent).toContain('a sinistra');
  });

  it('with the library closed, says how to open it', () => {
    expect(setup([], false).querySelector('.hint')?.textContent).toContain('libreria');
  });

  it('shows at most 4 recent songs, skips deleted ones, and links to them', () => {
    const el = setup(['b', 'gone', 'a', 'c', 'd', 'e']);
    const rows = Array.from(el.querySelectorAll<HTMLAnchorElement>('.recent'));
    expect(rows.map((row) => row.querySelector('.song-title')?.textContent)).toEqual(['Canto b', 'Canto a', 'Canto c', 'Canto d']);
    expect(rows[0].getAttribute('href')).toBe('/canto/b');
    expect(el.querySelector('.hint')).toBeNull();
  });
});
