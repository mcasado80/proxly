import { Component, EventEmitter, Output } from '@angular/core';
import { GoogleMapsLoaderService } from 'src/app/services/google-maps-loader.service';
import { SearchHistoryService } from 'src/app/services/search-history.service';

@Component({
  selector: 'app-searchbar',
  templateUrl: './searchbar.component.html',
  styleUrls: ['./searchbar.component.scss'],
})
export class SearchbarComponent {
  query: string = '';
  suggestions: any[] = [];
  private searchTimeoutId: any;
  private autocompleteService?: google.maps.places.AutocompleteService;
  private placesService?: google.maps.places.PlacesService;
  private sessionToken?: google.maps.places.AutocompleteSessionToken;

  @Output() locationSelected = new EventEmitter<{ lat: number; lng: number }>();

  constructor(
    private mapsLoader: GoogleMapsLoaderService,
    private history: SearchHistoryService
  ) {}

  private async ensureServices() {
    if (this.autocompleteService) return;
    await this.mapsLoader.load(['places']);
    this.autocompleteService = new google.maps.places.AutocompleteService();
    // PlacesService requires an HTMLDivElement or Map
    const div = document.createElement('div');
    this.placesService = new google.maps.places.PlacesService(div);
  }

  private getSessionToken(): google.maps.places.AutocompleteSessionToken {
    if (!this.sessionToken) {
      this.sessionToken = new google.maps.places.AutocompleteSessionToken();
    }
    return this.sessionToken;
  }

  private resetSessionToken() {
    this.sessionToken = undefined;
  }

  // Función para buscar direcciones usando AutocompleteService con debounce
  async searchLocation() {
    const trimmed = this.query.trim();
    // Limpiar si está vacío o muy corto
    if (trimmed.length <= 2) {
      this.suggestions = [];
      if (this.searchTimeoutId) {
        clearTimeout(this.searchTimeoutId);
        this.searchTimeoutId = undefined;
      }
      return;
    }

    // Debounce: esperar 350ms tras el último input
    if (this.searchTimeoutId) {
      clearTimeout(this.searchTimeoutId);
    }
    this.searchTimeoutId = setTimeout(async () => {
      try {
        await this.ensureServices();
        const response = await this.autocompleteService!.getPlacePredictions({
          input: trimmed,
          sessionToken: this.getSessionToken(),
        });
        this.suggestions = (response.predictions || []).map((p) => ({
          description: p.description,
          placeId: p.place_id,
        }));
      } catch {
        this.suggestions = [];
      }
    }, 350);
  }

  // Función para seleccionar una dirección
  async selectSuggestion(suggestion: any) {
    if (!suggestion?.placeId) return;

    try {
      await this.ensureServices();
      await new Promise<void>((resolve, reject) => {
        this.placesService!.getDetails(
          {
            placeId: suggestion.placeId,
            fields: ['geometry', 'formatted_address', 'name'],
            sessionToken: this.getSessionToken(),
          },
          (
            place: google.maps.places.PlaceResult | null,
            status: google.maps.places.PlacesServiceStatus
          ) => {
            if (
              status !== google.maps.places.PlacesServiceStatus.OK ||
              !place?.geometry?.location
            ) {
              return reject(status);
            }
            const loc = place.geometry.location;
            const latlng = { lat: loc.lat(), lng: loc.lng() };
            const text =
              suggestion.description || place.formatted_address || '';
            this.query = text;
            this.locationSelected.emit(latlng);
            this.history.add(text, latlng.lat, latlng.lng);
            this.suggestions = [];
            this.resetSessionToken();
            resolve();
          }
        );
      });
    } catch {
      // place details unavailable
    }
  }
}
