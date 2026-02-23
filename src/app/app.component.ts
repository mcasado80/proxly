import { Component } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs/operators';
import { StorageService } from './services/storage.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(
    private translate: TranslateService,
    private titleService: Title,
    private metaService: Meta,
    private storage: StorageService
  ) {
    this.initializeTranslation();
  }

  initializeTranslation() {
    // Obtener idioma guardado o usar sistema
    const savedLanguage = this.storage.get('language');
    let langToUse: string;

    if (savedLanguage === 'es' || savedLanguage === 'en') {
      langToUse = savedLanguage;
    } else {
      // Default o system: usar idioma del navegador
      const browserLang = this.translate.getBrowserLang();
      langToUse = browserLang?.match(/en|es/) ? browserLang : 'es';
    }

    this.translate.setDefaultLang(langToUse);
    this.translate.use(langToUse);

    this.translate.get('META.TITLE').pipe(take(1)).subscribe((res: string) => {
      this.titleService.setTitle(res);
    });

    this.translate.get('META.DESCRIPTION').pipe(take(1)).subscribe((res: string) => {
      this.metaService.updateTag({ name: 'description', content: res });
    });
  }
}
