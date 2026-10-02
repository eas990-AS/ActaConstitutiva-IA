import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CircleMarker, Polyline, Popup, Tooltip } from 'react-leaflet';
import { api } from '../api';
import { ErrorBox, Loading } from '../components/common';
import { BaseMap, FitBounds } from '../components/maps';
import { useAsync } from '../hooks';
import { FAIL_REASON_LABEL, RESULT_LABEL } from '../labels';
import type { LatLng } from '../types';
import { fmtDateTime, fmtKm, fmtMeters, fmtTime } from '../utils';

export default function RoutePathPage() {
  const { routeId = '' } = useParams();
  const name = (useLocation().state as { name?: string } | null)?.name;
  const path = useAsync(() => api.routePath(routeId), [routeId]);

  const points = useMemo(
    () => [...(path.data?.points ?? [])].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)),
    [path.data],
  );
  const fit: LatLng[] = useMemo(() => {
    const pts: LatLng[] = points.map((p) => ({ lat: p.lat, lng: p.lng }));
    path.data?.attempts.forEach((a) => a.location && pts.push(a.location));
    return pts;
  }, [points, path.data]);

  const r = path.data?.route;
  const attempts = [...(path.data?.attempts ?? [])].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const delivered = attempts.filter((a) => a.result === 'DELIVERED').length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          {r && (
            <Link to={`/repartidores/${r.courierId}/recorridos`} state={{ name }} className="small">
              ← Recorridos
            </Link>
          )}
          <h1>Trayecto {name ? `de ${name}` : ''} {r ? `· ${r.date}` : ''}</h1>
        </div>
      </header>
      <ErrorBox error={path.error} onRetry={path.reload} />
      {path.loading && !path.data ? (
        <Loading />
      ) : (
        r && (
          <>
            <div className="kpis">
              <div className="kpi">
                <span className="kpi-label">Inicio</span>
                <span className="kpi-value sm">{fmtTime(r.startedAt)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Fin</span>
                <span className="kpi-value sm">{r.endedAt ? fmtTime(r.endedAt) : 'En curso'}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Distancia</span>
                <span className="kpi-value sm">{fmtKm(r.distanceKm)}</span>
              </div>
              <div className="kpi ok">
                <span className="kpi-label">Entregados</span>
                <span className="kpi-value sm">{delivered}</span>
              </div>
              <div className="kpi bad">
                <span className="kpi-label">Fallidos</span>
                <span className="kpi-value sm">{attempts.length - delivered}</span>
              </div>
            </div>
            <section className="card">
              <BaseMap className="map map-lg">
                <Polyline positions={points.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.8 }} />
                {r.startLocation && (
                  <CircleMarker center={[r.startLocation.lat, r.startLocation.lng]} radius={7} pathOptions={{ color: '#111827', fillColor: '#fff', fillOpacity: 1 }}>
                    <Tooltip>Inicio · {fmtTime(r.startedAt)}</Tooltip>
                  </CircleMarker>
                )}
                {r.endLocation && (
                  <CircleMarker center={[r.endLocation.lat, r.endLocation.lng]} radius={7} pathOptions={{ color: '#fff', fillColor: '#111827', fillOpacity: 1 }}>
                    <Tooltip>Fin · {fmtTime(r.endedAt)}</Tooltip>
                  </CircleMarker>
                )}
                {attempts.map(
                  (a) =>
                    a.location && (
                      <CircleMarker
                        key={a.id}
                        center={[a.location.lat, a.location.lng]}
                        radius={8}
                        pathOptions={{ color: '#fff', weight: 2, fillColor: a.result === 'DELIVERED' ? '#16a34a' : '#dc2626', fillOpacity: 1 }}
                      >
                        <Popup>
                          <strong>{RESULT_LABEL[a.result]}</strong>
                          {a.failReason ? ` · ${FAIL_REASON_LABEL[a.failReason]}` : ''}
                          <br />
                          {fmtDateTime(a.occurredAt)}
                          <br />
                          Distancia al destino: {fmtMeters(a.distanceMeters)}
                          <br />
                          <Link to={`/entregas/${a.packageId}`}>Ver paquete</Link>
                        </Popup>
                      </CircleMarker>
                    ),
                )}
                <FitBounds points={fit} fitKey={`${routeId}-${fit.length > 0}`} />
              </BaseMap>
              <div className="legend">
                <span>
                  <i style={{ background: '#2563eb' }} /> Trayecto GPS ({points.length} puntos)
                </span>
                <span>
                  <i style={{ background: '#16a34a' }} /> Entregado
                </span>
                <span>
                  <i style={{ background: '#dc2626' }} /> No entregado
                </span>
              </div>
            </section>
          </>
        )
      )}
    </div>
  );
}
