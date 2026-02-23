import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { DistanceUnit, metersToFeet, feetToMeters } from 'src/app/utils/geo.utils';

@Injectable({ providedIn: 'root' })
export class DistanceUnitService {
  unit: DistanceUnit = 'metric';

  constructor(private storage: StorageService) {}

  load(): void {
    const saved = this.storage.get('distanceUnit');
    this.unit = saved === 'imperial' ? 'imperial' : 'metric';
  }

  save(): void {
    this.storage.set('distanceUnit', this.unit);
  }

  get radiusUnitLabel(): string {
    return this.unit === 'imperial' ? 'ft' : 'm';
  }

  radiusInUnit(meters: number): number {
    if (this.unit === 'imperial') {
      return Math.round(metersToFeet(meters));
    }
    return meters;
  }

  rangeValueToMeters(value: number): number {
    if (this.unit === 'imperial') {
      return Math.round(feetToMeters(value));
    }
    return value;
  }

  get rangeMin(): number {
    return this.unit === 'imperial' ? 330 : 100;
  }

  get rangeMax(): number {
    return this.unit === 'imperial' ? 3280 : 1000;
  }

  get rangeStep(): number {
    return this.unit === 'imperial' ? 165 : 50;
  }

  get rangeMinLabel(): string {
    return this.unit === 'imperial' ? '330ft' : '100m';
  }

  get rangeMaxLabel(): string {
    return this.unit === 'imperial' ? '3280ft' : '1000m';
  }
}
