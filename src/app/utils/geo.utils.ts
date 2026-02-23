export type DistanceUnit = 'metric' | 'imperial';

const EARTH_RADIUS_M = 6371000;
const METERS_TO_FEET = 3.28084;
const METERS_TO_MILES = 0.000621371;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDlat = Math.sin(dLat / 2);
  const sinDlng = Math.sin(dLng / 2);
  const aHarv =
    sinDlat * sinDlat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDlng * sinDlng;
  const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv));
  return EARTH_RADIUS_M * c;
}

export function formatDistance(meters: number, unit: DistanceUnit): string {
  const rounded = Math.round(meters);

  if (unit === 'imperial') {
    const miles = rounded * METERS_TO_MILES;
    if (miles < 0.1) {
      return `${Math.round(rounded * METERS_TO_FEET)}ft`;
    }
    return `${miles.toFixed(1)}mi`;
  }

  if (rounded < 1000) {
    return `${rounded}m`;
  }
  return `${(rounded / 1000).toFixed(1)}km`;
}

export function metersToFeet(m: number): number {
  return m * METERS_TO_FEET;
}

export function feetToMeters(ft: number): number {
  return ft / METERS_TO_FEET;
}
