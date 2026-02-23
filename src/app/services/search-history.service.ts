import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';

export interface SearchRecord {
  id: string;
  description: string;
  lat: number;
  lng: number;
  favorite: boolean;
  ts: number;
}

@Injectable({ providedIn: 'root' })
export class SearchHistoryService {
  private readonly storageKey = 'searchHistory';
  private readonly maxItems = 10;

  constructor(private storage: StorageService) {}

  getHistory(): SearchRecord[] {
    return this.storage.get<SearchRecord[]>(this.storageKey, []);
  }

  add(description: string, lat: number, lng: number): void {
    const list = this.getHistory();
    // Evitar duplicados por misma descripción y coords
    const existingIdx = list.findIndex(
      (r) => r.description === description && r.lat === lat && r.lng === lng
    );
    if (existingIdx !== -1) {
      // Moverlo al tope
      const [item] = list.splice(existingIdx, 1);
      item.ts = Date.now();
      list.unshift(item);
    } else {
      list.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        description,
        lat,
        lng,
        favorite: false,
        ts: Date.now(),
      });
    }
    // Mantener tope de 10, preservando favoritos
    const favorites = list.filter((r) => r.favorite);
    const nonFavs = list
      .filter((r) => !r.favorite)
      .slice(0, this.maxItems - favorites.length);
    const merged = [...favorites, ...nonFavs].slice(0, this.maxItems);
    this.storage.set(this.storageKey, merged);
  }

  toggleFavorite(id: string): void {
    const list = this.getHistory();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return;
    list[idx].favorite = !list[idx].favorite;
    this.storage.set(this.storageKey, list);
  }

  clearAll(): void {
    // Borrar todo excepto favoritos
    const list = this.getHistory();
    const favorites = list.filter((r) => r.favorite);
    // Si hay más de maxItems favoritos, recortar por fecha
    const pruned = favorites
      .sort((a, b) => b.ts - a.ts)
      .slice(0, this.maxItems);
    this.storage.set(this.storageKey, pruned);
  }
}
