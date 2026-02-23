import { Component, OnInit, OnDestroy, ViewChild, NgZone } from '@angular/core';
import { MenuController } from '@ionic/angular';
import {
  SearchHistoryService,
  SearchRecord,
} from 'src/app/services/search-history.service';
import { SearchbarComponent } from 'src/app/components/searchbar/searchbar.component';
import { StorageService } from 'src/app/services/storage.service';
import { GeolocationService } from 'src/app/services/geolocation.service';
import { NotificationsService } from 'src/app/services/notifications.service';
import { environment } from 'src/environments/environment';
import { GoogleMapsLoaderService } from 'src/app/services/google-maps-loader.service';
import { BackgroundGeofenceService } from 'src/app/services/background-geofence.service';
import { ThemeService } from 'src/app/services/theme.service';
import { DistanceUnitService } from 'src/app/services/distance-unit.service';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { haversineMeters, formatDistance } from 'src/app/utils/geo.utils';

@Component({
  selector: 'app-map',
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss'],
})
export class MapPage implements OnInit, OnDestroy {
  @ViewChild(SearchbarComponent) searchbarComponent!: SearchbarComponent;
  map!: google.maps.Map;
  marker!: google.maps.marker.AdvancedMarkerElement;
  circle!: google.maps.Circle;
  radius: number = 500; // Valor por defecto del radio
  centerLatLng!: google.maps.LatLngLiteral;
  userMarker?: google.maps.marker.AdvancedMarkerElement;
  userLatLng?: google.maps.LatLngLiteral;
  alreadyNotified: boolean = false;
  armed: boolean = false;
  showArrivalOverlay: boolean = false;
  private overlayHideTimeout: ReturnType<typeof setTimeout> | null = null;
  historyList: SearchRecord[] = [];
  geofencingEnabled: boolean = false;
  distanceToDestination: number | null = null;
  language: 'system' | 'es' | 'en' = 'system';
  isHelpModalOpen: boolean = false;
  private enabledSub?: Subscription;

  constructor(
    private storageService: StorageService,
    private geolocationService: GeolocationService,
    private notificationsService: NotificationsService,
    private bgGeofence: BackgroundGeofenceService,
    private mapsLoader: GoogleMapsLoaderService,
    public menuCtrl: MenuController,
    private historySvc: SearchHistoryService,
    private ngZone: NgZone,
    private translate: TranslateService,
    public themeSvc: ThemeService,
    public distanceUnitSvc: DistanceUnitService
  ) {}

  async ngOnInit() {
    await this.mapsLoader.load();
    this.themeSvc.init(() => this.updateMapIdForTheme());
    this.enabledSub = this.bgGeofence.enabled.subscribe((enabled) => {
      this.ngZone.run(() => {
        this.geofencingEnabled = enabled;
      });
    });
    this.distanceUnitSvc.load();
    this.loadLanguagePreference();
    await this.loadMap();
  }

  ngOnDestroy() {
    this.cleanupMapListeners();
    this.geolocationService.stopWatch();
    if (this.geofencingEnabled) {
      this.bgGeofence.stop();
    }
    if (this.overlayHideTimeout) {
      clearTimeout(this.overlayHideTimeout);
      this.overlayHideTimeout = null;
    }
    this.enabledSub?.unsubscribe();
    this.themeSvc.destroy();
  }

  private cleanupMapListeners() {
    if (this.map) {
      google.maps.event.clearInstanceListeners(this.map);
    }
    if (this.marker) {
      google.maps.event.clearInstanceListeners(this.marker);
    }
    if (this.circle) {
      google.maps.event.clearInstanceListeners(this.circle);
    }
    if (this.userMarker) {
      this.userMarker.map = null;
    }
  }

  async loadMap() {
    // Obtener el radio guardado en la configuración
    const savedRadius = this.storageService.get('radius');
    if (typeof savedRadius === 'number') {
      this.radius = savedRadius;
    }

    // Obtener la ubicación del usuario
    const initMap = async (lat: number, lng: number) => {
        this.centerLatLng = { lat, lng };

        // Inicializar Google Map
        const { ColorScheme } = (await google.maps.importLibrary(
          'core'
        )) as any;
        this.map = new google.maps.Map(
          document.getElementById('mapId') as HTMLElement,
          {
            center: { lat, lng },
            zoom: 14,
            disableDefaultUI: true,
            mapTypeId: 'roadmap',
            mapId: environment.mapId,
            colorScheme:
              this.themeSvc.theme === 'dark'
                ? ColorScheme.DARK
                : this.themeSvc.theme === 'light'
                ? ColorScheme.LIGHT
                : ColorScheme.FOLLOW_SYSTEM,
            clickableIcons: false,
          }
        );
        // Prevenir que se abran InfoWindows en cualquier parte del mapa
        this.map.addListener('idle', () => {
          this.clearInfoWindows();
        });

        // Agregar marcador draggeable
        this.marker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat, lng },
          map: this.map,
          gmpDraggable: true,
        });

        // Agregar círculo geofence
        this.circle = new google.maps.Circle({
          center: { lat, lng },
          radius: this.radius,
          strokeColor: '#1976d2',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: '#1976d2',
          fillOpacity: 0.2,
          map: this.map,
        });

        // Click para mover marcador
        this.map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const newLatLng = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          this.ngZone.run(() => {
            this.moveMarker(newLatLng);
          });
        });

        // Drag end del marcador
        this.marker.addListener('dragend', () => {
          this.ngZone.run(() => {
            const pos = this.marker.position;
            if (!pos) return;
            let position: google.maps.LatLngLiteral;
            if (pos instanceof google.maps.LatLng) {
              position = { lat: pos.lat(), lng: pos.lng() };
            } else {
              position = {
                lat: (pos as google.maps.LatLngLiteral).lat,
                lng: (pos as google.maps.LatLngLiteral).lng,
              };
            }
            this.updateCircle(position);
            this.armed = true;
            if (this.userLatLng) {
              const distance = haversineMeters(
                this.userLatLng,
                position
              );
              if (
                distance <= this.radius &&
                !this.alreadyNotified &&
                this.armed &&
                this.geofencingEnabled
              ) {
                this.alreadyNotified = true;
                this.armed = false;
                this.notificationsService.notifyArrival(
                  'Ya llegás',
                  'Ingresaste al radio de destino. Preparáte para bajar.'
                );
                this.triggerArrivalUI();
              }
            }
          });
        });

        // Iniciar seguimiento de la ubicación del usuario
        this.startLocationWatch();
        // Iniciar background watcher solo si está habilitado
        if (this.geofencingEnabled) {
          this.bgGeofence.start();
        }
        // Cargar historial
        this.refreshHistory();
        // Aplicar mapId acorde al tema si corresponde
        this.updateMapIdForTheme();
        // Calcular distancia inicial si hay destino
        this.updateDistanceToDestination();
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => initMap(position.coords.latitude, position.coords.longitude),
        () => {
          initMap(-34.6037, -58.3816); // Buenos Aires fallback
        }
      );
    } else {
      await initMap(-34.6037, -58.3816); // Geolocation not supported
    }
  }

  // Función para centrar el pin en la ubicación actual
  centerOnCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const newLatLng = { lat, lng };
          this.moveMarker(newLatLng);
          this.map.setCenter(newLatLng);
          this.map.setZoom(14);
        },
        () => { /* geolocation unavailable */ }
      );
    }
  }

  // Función para mover el pin al hacer clic en el mapa o al obtener la ubicación actual
  moveMarker(latlng: google.maps.LatLngLiteral) {
    this.marker.position = latlng;
    this.updateCircle(latlng);
    this.updateAddress(latlng);
    // Asegurar que la searchbar reciba foco tras actualizar texto
    setTimeout(() => {
      // Hack: click “inocuo” en el toolbar para recuperar foco del documento
      const tb = document.getElementById('appToolbar');
      tb?.click?.();
      const sb = document.querySelector('app-searchbar ion-searchbar') as any;
      sb?.setFocus?.();
    }, 0);
  }

  // Función para actualizar el círculo y centrarlo en la nueva posición del pin
  updateCircle(latlng: google.maps.LatLngLiteral) {
    this.circle.setCenter(latlng);
    this.centerLatLng = latlng;
    this.alreadyNotified = false; // restablecer al cambiar destino
    this.armed = true; // armar la geocerca tras elegir destino
    this.bgGeofence.setDestination({ lat: latlng.lat, lng: latlng.lng });
    this.updateDistanceToDestination();
  }

  // Función para actualizar el radio del círculo cuando se modifica el slider
  updateCircleRadius() {
    if (this.circle) {
      this.circle.setRadius(this.radius);
      this.storageService.set('radius', this.radius); // Guardar el nuevo radio
      this.alreadyNotified = false; // restablecer al cambiar radio
      this.armed = true;
      this.bgGeofence.setRadius(this.radius);
    }
  }

  async updateAddress(latlng: google.maps.LatLngLiteral) {
    try {
      await this.mapsLoader.load();
      // @ts-ignore
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ location: latlng });
      const address = response.results?.[0]?.formatted_address || '';
      this.searchbarComponent.query = address;
      if (address) {
        this.historySvc.add(address, latlng.lat, latlng.lng);
        this.refreshHistory();
      }
    } catch {
      // reverse geocoding failed silently
    }
  }

  private async startLocationWatch() {
    await this.notificationsService.requestPermissions();
    await this.geolocationService.startWatch(
      (coords) => this.onPositionUpdate(coords.lat, coords.lng),
      () => { /* geolocation error */ }
    );
  }

  private onPositionUpdate(lat: number, lng: number) {
    const newLatLng = { lat, lng };
    this.userLatLng = newLatLng;
    this.updateDistanceToDestination();

    // Pintar marcador del usuario
    if (!this.userMarker) {
      // Crear un elemento visual para el AdvancedMarker
      const userDot = document.createElement('div');
      userDot.style.background = '#1976d2';
      userDot.style.width = '12px';
      userDot.style.height = '12px';
      userDot.style.borderRadius = '50%';
      userDot.style.boxShadow = '0 0 0 3px rgba(25,118,210,0.25)';
      this.userMarker = new google.maps.marker.AdvancedMarkerElement({
        position: newLatLng,
        map: this.map,
        content: userDot,
      });
    } else {
      this.userMarker.position = newLatLng;
    }

    // Calcular distancia a destino (Haversine)
    if (this.centerLatLng && this.radius) {
      const distance = haversineMeters(newLatLng, this.centerLatLng);
      const exitThreshold = this.radius * 1.2; // histeresis de salida
      // Permitir re-armar la alerta si nos alejamos lo suficiente
      if (distance > exitThreshold && this.alreadyNotified) {
        this.alreadyNotified = false;
        this.armed = true;
      }
      // Si entra al radio y aún no avisamos (solo si geofencing está habilitado)
      if (distance <= this.radius && !this.alreadyNotified && this.armed && this.geofencingEnabled) {
        this.alreadyNotified = true;
        this.armed = false; // desarmar hasta salir
        const formattedDistance = this.formattedDistance || 'cerca';
        this.notificationsService.notifyArrival(
          'Proxly: Ya llegás',
          `Entraste al destino (${formattedDistance}). Preparáte para bajar.`
        );
        this.triggerArrivalUI();
      }
    }
  }


  private triggerArrivalUI() {
    this.showArrivalOverlay = true;
    if (this.overlayHideTimeout) {
      clearTimeout(this.overlayHideTimeout);
    }
    this.overlayHideTimeout = setTimeout(() => {
      this.showArrivalOverlay = false;
      this.overlayHideTimeout = null;
    }, 5000);
  }

  dismissArrivalOverlay() {
    this.showArrivalOverlay = false;
    if (this.overlayHideTimeout) {
      clearTimeout(this.overlayHideTimeout);
      this.overlayHideTimeout = null;
    }
  }

  // UI helpers
  openSettingsMenu() {
    this.menuCtrl.open('first');
  }

  applyTheme() {
    this.themeSvc.apply();
  }

  onMenuOpened() {
    // Evitar foco retenido en backdrop: asegurar foco dentro del menú
    const menuEl = document.querySelector('ion-menu[menuId="first"]') as any;
    const firstFocusable = menuEl?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (firstFocusable as HTMLElement)?.focus?.();
  }

  onMenuClosed() {
    // Devolver foco a un control visible en el contenido
    const fab = document.querySelector('ion-fab-button') as HTMLElement | null;
    fab?.focus?.();
  }

  onMenuWillOpen() {
    // Asegurar que el backdrop no reciba foco
    const backdrops = document.querySelectorAll('ion-backdrop');
    backdrops.forEach((bd) => {
      bd.setAttribute('inert', '');
      bd.removeAttribute('tabindex');
      bd.setAttribute('aria-hidden', 'true');
    });
  }

  onMenuWillClose() {
    // Limpiar inert del backdrop y devolver foco a un control visible
    const backdrops = document.querySelectorAll('ion-backdrop');
    backdrops.forEach((bd) => {
      bd.removeAttribute('inert');
      bd.removeAttribute('aria-hidden');
    });
    // Forzar blur del backdrop si quedó enfocado
    const active = document.activeElement as HTMLElement | null;
    if (active && active.tagName.toLowerCase() === 'ion-backdrop') {
      active.blur();
    }
    const content = document.getElementById('mapId');
    (content as HTMLElement)?.focus?.({ preventScroll: true });
  }

  refreshHistory() {
    this.historyList = this.historySvc.getHistory();
  }

  toggleFavorite(r: SearchRecord) {
    this.historySvc.toggleFavorite(r.id);
    this.refreshHistory();
  }

  clearHistory() {
    this.historySvc.clearAll();
    this.refreshHistory();
  }

  goToHistory(r: SearchRecord) {
    this.moveMarker({ lat: r.lat, lng: r.lng });
    this.menuCtrl.close('first');
  }

  private async updateMapIdForTheme() {
    if (!this.map) return;
    this.cleanupMapListeners();
    const useDark = this.themeSvc.isDark();

    // Re-crear el mapa cambiando colorScheme (un solo mapId)
    const el = document.getElementById('mapId') as HTMLElement;
    const center = this.centerLatLng ||
      this.map.getCenter()?.toJSON() || { lat: -34.6, lng: -58.45 };
    const zoom = this.map.getZoom() || 14;

    const { ColorScheme } = (await google.maps.importLibrary('core')) as any;
    const newMap = new google.maps.Map(el, {
      center,
      zoom,
      disableDefaultUI: true,
      mapTypeId: 'roadmap',
      mapId: environment.mapId,
      colorScheme: useDark
        ? ColorScheme.DARK
        : this.themeSvc.theme === 'light'
        ? ColorScheme.LIGHT
        : ColorScheme.FOLLOW_SYSTEM,
      clickableIcons: false,
    });

    const destPos =
      this.marker?.position instanceof google.maps.LatLng
        ? { lat: this.marker.position.lat(), lng: this.marker.position.lng() }
        : (this.marker?.position as google.maps.LatLngLiteral) || center;
    const newMarker = new google.maps.marker.AdvancedMarkerElement({
      position: destPos,
      map: newMap,
      gmpDraggable: true,
    });

    const newCircle = new google.maps.Circle({
      center: destPos,
      radius: this.radius,
      strokeColor: '#1976d2',
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: '#1976d2',
      fillOpacity: 0.2,
      map: newMap,
    });

    newMap.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const newLatLng = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      this.moveMarker(newLatLng);
    });

    // Prevenir que se abran InfoWindows en cualquier parte del mapa
    newMap.addListener('idle', () => {
      this.clearInfoWindows();
    });

    newMarker.addListener('dragend', () => {
      const pos = newMarker.position;
      if (!pos) return;
      let position: google.maps.LatLngLiteral;
      if (pos instanceof google.maps.LatLng) {
        position = { lat: pos.lat(), lng: pos.lng() };
      } else {
        position = pos as google.maps.LatLngLiteral;
      }
      this.updateCircle(position);
      this.armed = true;
      if (this.userLatLng) {
        const distance = haversineMeters(this.userLatLng, position);
        if (distance <= this.radius && !this.alreadyNotified && this.armed && this.geofencingEnabled) {
          this.alreadyNotified = true;
          this.armed = false;
          this.notificationsService.notifyArrival(
            'Ya llegás',
            'Ingresaste al radio de destino. Preparáte para bajar.'
          );
          this.triggerArrivalUI();
        }
      }
    });

    if (this.userLatLng) {
      const userDot = document.createElement('div');
      userDot.style.background = '#1976d2';
      userDot.style.width = '12px';
      userDot.style.height = '12px';
      userDot.style.borderRadius = '50%';
      userDot.style.boxShadow = '0 0 0 3px rgba(25,118,210,0.25)';
      this.userMarker = new google.maps.marker.AdvancedMarkerElement({
        position: this.userLatLng,
        map: newMap,
        content: userDot,
      });
    }

    this.map = newMap;
    this.marker = newMarker;
    this.circle = newCircle;
  }

  // Toggle del geofencing
  async toggleGeofencing() {
    // Forzar detección de cambios inmediata
    this.ngZone.run(async () => {
      this.bgGeofence.setEnabled(this.geofencingEnabled);

      if (this.geofencingEnabled) {
        // Activar geofencing
        await this.bgGeofence.start();
      } else {
        // Desactivar geofencing
        await this.bgGeofence.stop();
      }
    });
  }

  // Actualizar distancia al destino
  private updateDistanceToDestination() {
    if (this.userLatLng && this.centerLatLng) {
      this.distanceToDestination = haversineMeters(
        this.userLatLng,
        this.centerLatLng
      );
    } else {
      this.distanceToDestination = null;
    }
  }

  get formattedDistance(): string {
    if (!this.distanceToDestination) return '';
    return formatDistance(this.distanceToDestination, this.distanceUnitSvc.unit);
  }

  // Obtener estado con distancia para el toggle
  get geofencingStatusText(): string {
    if (!this.geofencingEnabled) {
      return 'SETTINGS.GEOFENCING_DISABLED';
    }

    if (this.distanceToDestination !== null) {
      return 'SETTINGS.GEOFENCING_ENABLED_WITH_DISTANCE';
    }

    return 'SETTINGS.GEOFENCING_ENABLED';
  }

  changeDistanceUnit() {
    this.distanceUnitSvc.save();
    if (this.circle) {
      this.updateCircleRadius();
    }
  }

  get radiusInSelectedUnit(): number {
    return this.distanceUnitSvc.radiusInUnit(this.radius);
  }

  get rangeValue(): number {
    return this.distanceUnitSvc.radiusInUnit(this.radius);
  }

  set rangeValue(value: number) {
    this.radius = this.distanceUnitSvc.rangeValueToMeters(value);
  }

  // Cargar preferencia de idioma desde storage
  private loadLanguagePreference() {
    const saved = this.storageService.get('language');
    this.language = saved === 'es' || saved === 'en' ? saved : 'system';
    this.applyLanguage();
  }

  // Cambiar idioma
  changeLanguage() {
    this.storageService.set('language', this.language);
    this.applyLanguage();
  }

  // Aplicar idioma seleccionado
  private applyLanguage() {
    let langToUse: string;

    if (this.language === 'system') {
      const browserLang = this.translate.getBrowserLang();
      langToUse = browserLang?.match(/en|es/) ? browserLang : 'es';
    } else {
      langToUse = this.language;
    }

    this.translate.use(langToUse);

    // Actualizar título y meta tags
    this.translate.get('META.TITLE').pipe(take(1)).subscribe((res: string) => {
      document.title = res;
    });
  }

  // Help Modal Methods
  showHelpModal() {
    this.isHelpModalOpen = true;
  }

  closeHelpModal() {
    this.isHelpModalOpen = false;
  }

  // Método helper para limpiar InfoWindows
  private clearInfoWindows() {
    const infoWindows = document.querySelectorAll('.gm-style-iw');
    infoWindows.forEach((iw) => {
      iw.parentNode?.removeChild(iw);
    });
  }
}
