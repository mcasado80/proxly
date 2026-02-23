import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

@Injectable({
  providedIn: 'root',
})
export class GeolocationService {
  private pluginWatchId: string | null = null;
  private browserWatchId: number | null = null;

  constructor() {}

  async getCurrentCoordinates(): Promise<{ lat: number; lng: number }> {
    try {
      if (Capacitor.isPluginAvailable('Geolocation')) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
        });
        return {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      }
    } catch (err) {
      // fallback below
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (error) => reject(error),
        { enableHighAccuracy: true }
      );
    });
  }

  async startWatch(
    onUpdate: (coords: { lat: number; lng: number }) => void,
    onError?: (error: any) => void
  ): Promise<void> {
    // Clear previous if any
    await this.stopWatch();

    try {
      if (Capacitor.isPluginAvailable('Geolocation')) {
        this.pluginWatchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000 },
          (position, err) => {
            if (err) {
              onError?.(err);
              return;
            }
            if (!position) return;
            onUpdate({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          }
        );
        return;
      }
    } catch (err) {
      // fallback below
    }

    if (navigator.geolocation) {
      this.browserWatchId = navigator.geolocation.watchPosition(
        (pos) =>
          onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => onError?.(err),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      );
    } else {
      onError?.(new Error('Geolocalización no soportada'));
    }
  }

  async stopWatch(): Promise<void> {
    try {
      if (this.pluginWatchId) {
        await Geolocation.clearWatch({ id: this.pluginWatchId });
        this.pluginWatchId = null;
      }
    } catch (_) {}

    if (this.browserWatchId !== null) {
      try {
        navigator.geolocation.clearWatch(this.browserWatchId);
      } catch (_) {}
      this.browserWatchId = null;
    }
  }
}
