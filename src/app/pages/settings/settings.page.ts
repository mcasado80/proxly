import { Component, OnInit } from '@angular/core';
import { StorageService } from 'src/app/services/storage.service'; // Servicio para manejar localStorage

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {

  radius: number = 500; // Valor por defecto

  constructor(private storageService: StorageService) {}

  ngOnInit() {
    this.loadSettings();
  }

  // Cargar la configuración guardada
  loadSettings() {
    const savedRadius = this.storageService.get('radius');
    if (typeof savedRadius === 'number') {
      this.radius = savedRadius;
    }
  }

  // Guardar la configuración
  saveSettings() {
    this.storageService.set('radius', this.radius);
  }
}
