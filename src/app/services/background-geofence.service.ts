import { Injectable } from '@angular/core';
import type {
  BackgroundGeolocationPlugin,
  WatcherOptions,
  Location,
  CallbackError,
} from '@capacitor-community/background-geolocation';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from './storage.service';
import { NotificationsService } from './notifications.service';
import { haversineMeters, formatDistance, DistanceUnit } from 'src/app/utils/geo.utils';

type LatLng = { lat: number; lng: number };

@Injectable({
  providedIn: 'root',
})
export class BackgroundGeofenceService {
  private watcherId: string | null = null;
  private destination?: LatLng;
  private radiusMeters: number = 500;
  private alreadyNotified: boolean = false;
  private armed: boolean = false;
  private enabled$ = new BehaviorSubject<boolean>(true);
  readonly enabled: Observable<boolean> = this.enabled$.asObservable();

  constructor(
    private storage: StorageService,
    private notifications: NotificationsService
  ) {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const savedRadius = this.storage.get('radius');
    if (typeof savedRadius === 'number') this.radiusMeters = savedRadius;
    const savedDest = this.storage.get('destination') as LatLng | null;
    if (
      savedDest &&
      typeof savedDest.lat === 'number' &&
      typeof savedDest.lng === 'number'
    ) {
      this.destination = savedDest;
    }
    const savedArmed = this.storage.get('armed');
    if (typeof savedArmed === 'boolean') this.armed = savedArmed;
    const savedEnabled = this.storage.get('geofencingEnabled');
    this.enabled$.next(savedEnabled === true); // Por defecto false (primera instalación)
  }

  setDestination(latlng: LatLng) {
    this.destination = latlng;
    this.storage.set('destination', latlng);
    this.alreadyNotified = false;
    this.armed = true;
    this.storage.set('armed', true);
  }

  setRadius(radius: number) {
    this.radiusMeters = radius;
    this.storage.set('radius', radius);
    this.alreadyNotified = false;
    this.armed = true;
    this.storage.set('armed', true);
  }

  async start(): Promise<void> {
    if (this.watcherId) return;
    // Evitar ejecutar el plugin en web, donde no está implementado
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    const opts: WatcherOptions = {
      requestPermissions: true,
      stale: false,
      backgroundMessage: 'Proxly monitoreando destino…',
      backgroundTitle: 'Proxly activo',
      distanceFilter: 20,
    };
    const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
      'BackgroundGeolocation'
    );
    this.watcherId = await BackgroundGeolocation.addWatcher(
      opts,
      (position?: Location, error?: CallbackError) => {
        if (error) return;
        if (!position) return;
        const { latitude, longitude } = position;
        this.onLocationUpdate(latitude, longitude);
      }
    );
  }

  async stop(): Promise<void> {
    if (!this.watcherId) return;
    if (!Capacitor.isNativePlatform()) {
      this.watcherId = null;
      return;
    }
    const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
      'BackgroundGeolocation'
    );
    await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
    this.watcherId = null;
  }

  private onLocationUpdate(lat: number, lng: number) {
    if (!this.destination || !this.radiusMeters || !this.enabled$.getValue()) return;
    const distance = haversineMeters(
      { lat, lng },
      this.destination
    );
    const exitThreshold = this.radiusMeters * 1.2;
    if (distance > exitThreshold && this.alreadyNotified) {
      this.alreadyNotified = false;
      this.armed = true;
      this.storage.set('armed', true);
    }
    if (distance <= this.radiusMeters && !this.alreadyNotified && this.armed) {
      this.alreadyNotified = true;
      this.armed = false;
      this.storage.set('armed', false);

      const saved = this.storage.get('distanceUnit');
      const distanceUnit: DistanceUnit = saved === 'imperial' ? 'imperial' : 'metric';
      const formattedDistance = formatDistance(distance, distanceUnit);
      this.notifications.notifyArrival(
        'Proxly: Ya llegás',
        `Entraste al destino (${formattedDistance}). Preparáte para bajar.`
      );

      // Apagar automáticamente el geofencing al llegar al destino
      this.setEnabled(false);
      this.stop();
    }
  }

  // Métodos para controlar el estado del geofencing
  setEnabled(enabled: boolean) {
    this.enabled$.next(enabled);
    this.storage.set('geofencingEnabled', enabled);
  }

  isEnabled(): boolean {
    return this.enabled$.getValue();
  }

  getStatus(): {
    enabled: boolean;
    watching: boolean;
    destination: LatLng | undefined;
    radius: number;
  } {
    return {
      enabled: this.enabled$.getValue(),
      watching: this.watcherId !== null,
      destination: this.destination,
      radius: this.radiusMeters,
    };
  }
}
