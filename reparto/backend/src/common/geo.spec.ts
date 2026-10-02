import { distanceMeters, nearestNeighborOrder, pathDistanceKm, pointInPolygon } from './geo';

const square = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 1 },
  { lat: 1, lng: 1 },
  { lat: 1, lng: 0 },
];

describe('geo', () => {
  it('detecta puntos dentro y fuera del polígono', () => {
    expect(pointInPolygon({ lat: 0.5, lng: 0.5 }, square)).toBe(true);
    expect(pointInPolygon({ lat: 1.5, lng: 0.5 }, square)).toBe(false);
    expect(pointInPolygon({ lat: 0.5, lng: -0.1 }, square)).toBe(false);
  });

  it('calcula distancias con haversine', () => {
    // Zócalo → Bellas Artes, ~1 km
    const d = distanceMeters({ lat: 19.4326, lng: -99.1332 }, { lat: 19.4352, lng: -99.1412 });
    expect(d).toBeGreaterThan(850);
    expect(d).toBeLessThan(950);
    expect(pathDistanceKm([{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }])).toBeCloseTo(111.19, 1);
  });

  it('ordena por vecino más cercano y deja al final lo que no tiene ubicación', () => {
    const items = [
      { id: 'far', at: { lat: 0, lng: 3 } },
      { id: 'none', at: null },
      { id: 'near', at: { lat: 0, lng: 1 } },
      { id: 'mid', at: { lat: 0, lng: 2 } },
    ];
    const order = nearestNeighborOrder(items, (i) => i.at, { lat: 0, lng: 0 }).map((i) => i.id);
    expect(order).toEqual(['near', 'mid', 'far', 'none']);
  });
});
