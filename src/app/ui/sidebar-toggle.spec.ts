import { TestBed } from '@angular/core/testing';
import { LayoutService } from '../services/layout.service';
import { SidebarToggle } from './sidebar-toggle';

describe('SidebarToggle', () => {
  it('appears only while the library is closed, and reopens it', () => {
    const fixture = TestBed.createComponent(SidebarToggle);
    const layout = TestBed.inject(LayoutService);
    layout.sidebarOpen.set(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('button')).toBeNull();

    layout.sidebarOpen.set(false);
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('button[aria-label="Mostra libreria"]')!.click();
    expect(layout.sidebarOpen()).toBe(true);
  });
});
