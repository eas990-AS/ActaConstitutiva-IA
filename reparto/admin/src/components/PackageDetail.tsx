import { CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import { api, resolveUrl } from '../api';
import { useAsync } from '../hooks';
import { EVIDENCE_LABEL, FAIL_REASON_LABEL, RESULT_LABEL } from '../labels';
import type { LatLng } from '../types';
import { fmtDateTime, fmtMeters } from '../utils';
import { ErrorBox, Loading, StatusBadge } from './common';
import { BaseMap, FitBounds } from './maps';

export default function PackageDetail({
  id,
  courierName,
  zoneName,
}: {
  id: string;
  courierName: (id: string | null) => string;
  zoneName: (id: string | null) => string;
}) {
  const pkg = useAsync(() => api.package(id), [id]);

  if (pkg.loading && !pkg.data) return <Loading />;
  if (pkg.error) return <ErrorBox error={pkg.error} onRetry={pkg.reload} />;
  const p = pkg.data;
  if (!p) return null;

  const history = [...p.history].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const mapPoints: LatLng[] = [];
  if (p.location) mapPoints.push(p.location);
  history.forEach((a) => a.location && mapPoints.push(a.location));

  return (
    <div className="detail">
      <dl className="kv">
        <dt>Guía</dt>
        <dd>
          <strong>{p.trackingCode}</strong> <StatusBadge status={p.status} />
        </dd>
        <dt>Destinatario</dt>
        <dd>{p.recipientName}</dd>
        <dt>Teléfono</dt>
        <dd>{p.recipientPhone ?? '—'}</dd>
        <dt>Dirección</dt>
        <dd>{p.address}</dd>
        <dt>Notas</dt>
        <dd>{p.notes ?? '—'}</dd>
        <dt>Fecha programada</dt>
        <dd>{p.scheduledDate}</dd>
        <dt>Zona</dt>
        <dd>{zoneName(p.zoneId)}</dd>
        <dt>Repartidor</dt>
        <dd>{courierName(p.courierId)}</dd>
        <dt>Intentos</dt>
        <dd>{p.attempts}</dd>
        <dt>Registrado</dt>
        <dd>{fmtDateTime(p.createdAt)}</dd>
      </dl>

      {mapPoints.length > 0 && (
        <>
          <h3>Mapa</h3>
          <BaseMap className="map map-sm">
            {p.location && (
              <CircleMarker center={[p.location.lat, p.location.lng]} radius={9} pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.9 }}>
                <Tooltip permanent direction="top">
                  Destino
                </Tooltip>
              </CircleMarker>
            )}
            {history.map(
              (a, i) =>
                a.location && (
                  <CircleMarker
                    key={a.id}
                    center={[a.location.lat, a.location.lng]}
                    radius={7}
                    pathOptions={{
                      color: '#fff',
                      weight: 2,
                      fillColor: a.result === 'DELIVERED' ? '#16a34a' : '#dc2626',
                      fillOpacity: 1,
                    }}
                  >
                    <Tooltip>
                      Intento {history.length - i}: {RESULT_LABEL[a.result]} · {fmtDateTime(a.occurredAt)}
                    </Tooltip>
                  </CircleMarker>
                ),
            )}
            {p.location &&
              history.map(
                (a) =>
                  a.location && (
                    <Polyline
                      key={`l-${a.id}`}
                      positions={[
                        [p.location!.lat, p.location!.lng],
                        [a.location.lat, a.location.lng],
                      ]}
                      pathOptions={{ color: '#6b7280', dashArray: '4 6', weight: 2 }}
                    />
                  ),
              )}
            <FitBounds points={mapPoints} fitKey={p.id} />
          </BaseMap>
          {!p.location && <p className="muted small">El paquete no tiene coordenadas de destino.</p>}
        </>
      )}

      <h3>Historial de intentos</h3>
      {history.length === 0 ? (
        <p className="muted">Sin intentos registrados.</p>
      ) : (
        history.map((a, i) => (
          <article key={a.id} className={`attempt ${a.result === 'DELIVERED' ? 'ok' : 'bad'}`}>
            <header className="row-between">
              <strong>
                Intento {history.length - i}: {RESULT_LABEL[a.result]}
              </strong>
              <small>{fmtDateTime(a.occurredAt)}</small>
            </header>
            <dl className="kv">
              <dt>Repartidor</dt>
              <dd>{courierName(a.courierId)}</dd>
              {a.failReason && (
                <>
                  <dt>Motivo</dt>
                  <dd>{FAIL_REASON_LABEL[a.failReason]}</dd>
                </>
              )}
              {a.recipientName && (
                <>
                  <dt>Recibió</dt>
                  <dd>{a.recipientName}</dd>
                </>
              )}
              {a.comment && (
                <>
                  <dt>Comentario</dt>
                  <dd>{a.comment}</dd>
                </>
              )}
              <dt>Distancia al destino</dt>
              <dd className={a.distanceMeters !== null && a.distanceMeters > 150 ? 'text-bad' : ''}>{fmtMeters(a.distanceMeters)}</dd>
              {a.distanceJustification && (
                <>
                  <dt>Justificación</dt>
                  <dd>{a.distanceJustification}</dd>
                </>
              )}
            </dl>
            {a.evidences.length > 0 && (
              <div className="evidences">
                {a.evidences.map((ev) => (
                  <figure key={ev.id} className={ev.kind === 'SIGNATURE' ? 'signature' : ''}>
                    <a href={resolveUrl(ev.url)} target="_blank" rel="noreferrer">
                      <img src={resolveUrl(ev.url)} alt={EVIDENCE_LABEL[ev.kind]} loading="lazy" />
                    </a>
                    <figcaption>{EVIDENCE_LABEL[ev.kind]}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </article>
        ))
      )}
    </div>
  );
}
