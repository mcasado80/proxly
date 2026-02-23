import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class StorageService {

  constructor() {}

  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  get<T>(key: string, fallback: T): T;
  get(key: string): unknown;
  get(key: string, fallback?: unknown): unknown {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback ?? null;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback ?? null;
    }
  }
}
