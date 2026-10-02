import { useEffect } from 'react';
import { MapContainer, Polygon, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression, LeafletMouseEvent } from 'leaflet';
import type { ReactNode } from 'react';
import type { LatLng, Zone } from '../types';
import { DEFAULT_CENTER } from '../utils';

export function BaseMap({
  children,
  center = DEFAULT_CENTER,
  zoom = 12,
  className = 'map',
}: {
  children?: ReactNode;
  center?: LatLngExpression;
  zoom?: number;
  className?: string;
}) {
  return (
    <MapContainer center={center} zoom={zoom} className={className} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainer>
  );
}

export function ZonesLayer({ zones, highlightId }: { zones: Zone[] | undefined; highlightId?: string }) {
  return (
    <>
      {zones?.map((z) => (
        <Polygon
          key={z.id}
          positions={z.polygon.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{
            color: z.color,
            fillColor: z.color,
            fillOpacity: z.id === highlightId ? 0.3 : 0.12,
            weight: z.id === highlightId ? 3 : 2,
          }}
        >
          <Tooltip sticky>{z.name}</Tooltip>
        </Polygon>
      ))}
    </>
  );
}

/** Ajusta la vista a los puntos dados cuando cambia la clave. */
export function FitBounds({ points, fitKey }: { points: LatLng[]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 16);
      return;
    }
    const bounds: LatLngBoundsExpression = points.map((p) => [p.lat, p.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

export function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}
