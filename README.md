# Proxly

Proximity-based arrival notifications. Set a destination on the map, choose a radius, and Proxly wakes you with a notification and haptics when you enter the zone -- so you never miss your stop.

## Tech Stack

- **Angular 18** + **Ionic 8** + **Capacitor 6**
- **Google Maps JS API** (Maps, Places, Geocoding)
- **Background Geolocation** (Capacitor plugin for geofencing while the app is backgrounded)
- **Local Notifications** + **Haptics**
- **i18n** via ngx-translate (English / Spanish)

## Features

- Real-time geofencing with configurable radius
- Background location tracking that survives app suspension
- Place search with Google Places autocomplete
- Search history persisted locally
- Light / dark / system theme support
- Metric and imperial unit toggle

## Project Structure

```
src/app/
  components/searchbar/   # Places autocomplete search bar
  pages/map/              # Main screen: map, geofence controls, menu
  pages/settings/         # User preferences
  services/               # Geofencing, notifications, geolocation, theme, storage
  utils/geo.utils.ts      # Haversine distance, unit conversions
scripts/
  set-env.js              # Generates environment.ts from .env at build time
```

## Running Locally

```bash
# 1. Clone and install
git clone https://github.com/mcasado80/proxly.git
cd proxly
npm install

# 2. Configure environment
cp .env.example .env
# Add your Google Maps API key and Map ID to .env

# 3. Start dev server
npm start
```

## Mobile Builds

```bash
npx cap sync
npx cap open ios       # Xcode
npx cap open android   # Android Studio
```

## License

MIT
