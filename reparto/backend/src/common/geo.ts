export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distancia en metros entre dos puntos (fórmula de haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Ray casting; el polígono no repite el primer vértice al final. */
export function pointInPolygon(p: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses =
      a.lat > p.lat !== b.lat > p.lat &&
      p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Longitud de una trayectoria en km. */
export function pathDistanceKm(points: LatLng[]): number {
  let meters = 0;
  for (let i = 1; i < points.length; i++) meters += distanceMeters(points[i - 1], points[i]);
  return meters / 1000;
}

/**
 * Ordena por vecino más cercano partiendo de `start`. Los elementos sin ubicación
 * se dejan al final en su orden original.
 */
export function nearestNeighborOrder<T>(
  items: T[],
  locate: (item: T) => LatLng | null,
  start: LatLng | null,
): T[] {
  const located = items.filter((i) => locate(i));
  const unlocated = items.filter((i) => !locate(i));
  if (!start || located.length === 0) return [...located, ...unlocated];
  const ordered: T[] = [];
  let current = start;
  const remaining = [...located];
  while (remaining.length) {
    let best = 0;
    let bestDist = Infinity;
    remaining.forEach((item, idx) => {
      const d = distanceMeters(current, locate(item)!);
      if (d < bestDist) {
        bestDist = d;
        best = idx;
      }
    });
    const [next] = remaining.splice(best, 1);
    ordered.push(next);
    current = locate(next)!;
  }
  return [...ordered, ...unlocated];
}

export function isValidPolygon(value: unknown): value is LatLng[] {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.every(
      (p) =>
        p &&
        typeof p.lat === 'number' &&
        typeof p.lng === 'number' &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180,
    )
  );
}
