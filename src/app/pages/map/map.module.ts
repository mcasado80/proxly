import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { MapPageRoutingModule } from './map-routing.module';

import { MapPage } from './map.page';
import { SearchbarModule } from 'src/app/components/searchbar/searchbar.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule,
    MapPageRoutingModule,
    SearchbarModule,
  ],
  declarations: [MapPage],
})
export class MapPageModule {}
