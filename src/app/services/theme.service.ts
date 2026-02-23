import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  theme: 'light' | 'dark' | 'system' = 'system';
  private prefersDarkMql?: MediaQueryList;
  private onThemeChanged?: () => void;
  private readonly onPrefersSchemeChange = (e: MediaQueryListEvent) => {
    if (this.theme !== 'system') return;
    const doc = document.documentElement;
    if (e.matches) {
      doc.classList.add('ion-palette-dark');
    } else {
      doc.classList.remove('ion-palette-dark');
    }
    this.onThemeChanged?.();
  };

  constructor(private storage: StorageService) {}

  init(onThemeChanged?: () => void): void {
    this.onThemeChanged = onThemeChanged;

    const saved = this.storage.get('theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      this.theme = saved;
    }

    // Apply immediately
    const doc = document.documentElement;
    const prefersDark =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark =
      this.theme === 'dark' || (this.theme === 'system' && prefersDark);
    if (useDark) {
      doc.classList.add('ion-palette-dark');
    } else {
      doc.classList.remove('ion-palette-dark');
    }

    // Listen for OS changes
    if (window && 'matchMedia' in window) {
      this.prefersDarkMql = window.matchMedia('(prefers-color-scheme: dark)');
      try {
        this.prefersDarkMql.addEventListener(
          'change',
          this.onPrefersSchemeChange
        );
      } catch (_) {
        // Safari < 14 fallback
        // @ts-ignore
        this.prefersDarkMql.addListener(this.onPrefersSchemeChange);
      }
    }
  }

  apply(): void {
    const doc = document.documentElement;
    const prefersDark = this.prefersDarkMql
      ? this.prefersDarkMql.matches
      : window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (this.theme === 'light') {
      doc.classList.remove('ion-palette-dark');
    } else if (this.theme === 'dark') {
      doc.classList.add('ion-palette-dark');
    } else {
      if (prefersDark) {
        doc.classList.add('ion-palette-dark');
      } else {
        doc.classList.remove('ion-palette-dark');
      }
    }
    this.storage.set('theme', this.theme);
    this.onThemeChanged?.();
  }

  destroy(): void {
    if (this.prefersDarkMql) {
      try {
        this.prefersDarkMql.removeEventListener(
          'change',
          this.onPrefersSchemeChange
        );
      } catch (_) {
        // @ts-ignore
        this.prefersDarkMql.removeListener(this.onPrefersSchemeChange);
      }
    }
  }

  isDark(): boolean {
    if (this.theme === 'dark') return true;
    if (this.theme === 'light') return false;
    return this.prefersDarkMql ? this.prefersDarkMql.matches : false;
  }
}
