import { Injectable } from '@angular/core';
import { Loader } from '@googlemaps/js-api-loader';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private loaderPromise?: Promise<void>;

  load(
    libraries: Array<'places' | 'marker'> = ['places', 'marker']
  ): Promise<void> {
    if (this.loaderPromise) return this.loaderPromise;
    const apiKey = (environment as any).googleMapsApiKey;
    if (!apiKey) {
      this.loaderPromise = Promise.resolve();
      return this.loaderPromise;
    }
    const loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries,
    });
    this.loaderPromise = loader.load().then(() => undefined);
    return this.loaderPromise;
  }
}
