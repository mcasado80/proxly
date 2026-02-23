import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  constructor() {}

  async requestPermissions(): Promise<boolean> {
    try {
      if (!Capacitor.isPluginAvailable('LocalNotifications')) return false;
      const perm = await LocalNotifications.requestPermissions();
      return perm.display === 'granted';
    } catch {
      return false;
    }
  }

  async notifyArrival(title: string, body: string) {
    try {
      if (Capacitor.isPluginAvailable('LocalNotifications')) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now(),
              title,
              body,
              sound: undefined,
              smallIcon: 'ic_stat_icon',
              schedule: { at: new Date(Date.now() + 10) },
            },
          ],
        });
      }
    } catch {}

    try {
      if (Capacitor.isPluginAvailable('Haptics')) {
        await Haptics.impact({ style: ImpactStyle.Heavy });
        await Haptics.vibrate({ duration: 500 });
      }
    } catch {}
  }
}
