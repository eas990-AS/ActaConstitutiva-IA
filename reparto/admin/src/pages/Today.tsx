import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Popup, useMap } from 'react-leaflet';
import { api, errorMessage } from '../api';
import { Empty, ErrorBox, Loading, ProgressBar, ZoneSelect } from '../components/common';
import { BaseMap, FitBounds, ZonesLayer } from '../components/maps';
import { useAsync } from '../hooks';
import { ALERT_LABEL, STATE_COLOR, STATE_LABEL } from '../labels';
import { useLiveSocket, type SocketStatus } from '../socket';
import type { Alert, LatLng, LiveCourier } from '../types';
import { distanceMeters, fmtAgo, fmtBattery, fmtPct, fmtTime, today } from '../utils';

function FlyTo({ target }: { target: { p: LatLng; n: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.p.lat, target.p.lng], Math.max(map.getZoom(), 15));
  }, [target, map]);
  return null;
}

const SOCKET_LABEL: Record<SocketStatus, string> = {
  connecting: 'Conectando…',
  connected: 'En vivo',
  disconnected: 'Desconectado',
  error: 'Sin conexión en vivo',
};

export default function TodayPage() {
  const [date, setDate] = useState(today());
  const [zoneId, setZoneId] = useState('');
  const isToday = date === today();

  const zones = useAsync(() => api.zones(), []);
  const report = useAsync(() => api.dailyReport(date, zoneId || undefined), [date, zoneId]);
  const live = useAsync(() => api.live(zoneId || undefined), [zoneId]);
  const alerts = useAsync(() => api.alerts({ pending: true }), []);
  const [flyTarget, setFlyTarget] = useState<{ p: LatLng; n: number } | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);

  // Refresco periódico del estado (NO_SIGNAL se calcula en el servidor).
  useEffect(() => {
    const t = setInterval(() => {
      live.reload();
    }, 60_000);
    return () => clearInterval(t);
  }, [live.reload]);

  const updateCourier = (courierId: string, fn: (c: LiveCourier) => LiveCourier): boolean => {
    let found = false;
    live.setData((prev) =>
      prev?.map((c) => {
        if (c.courier.id !== courierId) return c;
        found = true;
        return fn(c);
      }),
    );
    return found;
  };
  const knows = (courierId: string) => !!live.data?.some((c) => c.courier.id === courierId);

  const socketStatus = useLiveSocket({
    location: ({ courierId, point }) => {
      if (!knows(courierId)) {
        if (!zoneId) live.reload();
        return;
      }
      updateCourier(courierId, (c) => {
        let state = c.state;
        if (c.route && !c.route.endedAt) {
          const moved = c.last ? distanceMeters(c.last, point) : 0;
          state = (point.speed ?? 0) > 1 || moved > 50 ? 'MOVING' : 'STOPPED';
        }
        return { ...c, last: point, state };
      });
    },
    route: ({ courierId, route, event }) => {
      if (!knows(courierId)) {
        if (!zoneId) live.reload();
        return;
      }
      updateCourier(courierId, (c) => ({ ...c, route, state: event === 'end' ? 'OFF' : c.last ? 'STOPPED' : 'NO_SIGNAL' }));
    },
    attempt: ({ courierId, attempt }) => {
      updateCourier(courierId, (c) => {
        const p = { ...c.progress };
        if (attempt.result === 'DELIVERED') p.delivered += 1;
        else p.failed += 1;
        p.pending = Math.max(0, p.pending - 1);
        return { ...c, progress: p };
      });
      if (isToday) report.reload();
    },
    alert: (a) => {
      alerts.setData((prev) => (prev?.some((x) => x.id === a.id) ? prev : [a, ...(prev ?? [])]));
    },
  });

  async function ack(a: Alert) {
    setAckError(null);
    try {
      await api.ackAlert(a.id);
      alerts.setData((prev) => prev?.filter((x) => x.id !== a.id));
    } catch (e) {
      setAckError(errorMessage(e));
    }
  }

  const couriers = useMemo(
    () => [...(live.data ?? [])].sort((a, b) => a.courier.name.localeCompare(b.courier.name, 'es')),
    [live.data],
  );
  const fitPoints = useMemo(() => {
    const pts: LatLng[] = couriers.filter((c) => c.last).map((c) => ({ lat: c.last!.lat, lng: c.last!.lng }));
    const zs = zones.data?.filter((z) => !zoneId || z.id === zoneId) ?? [];
    if (pts.length === 0) zs.forEach((z) => pts.push(...z.polygon));
    return pts;
  }, [couriers, zones.data, zoneId]);
  const fitKey = `${zoneId}|${live.data ? 'l' : ''}|${zones.data ? 'z' : ''}`;

  const t = report.data?.totals;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Hoy</h1>
        <div className="filters">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
          <ZoneSelect zones={zones.data} value={zoneId} onChange={setZoneId} />
          <span className={`live-dot ${socketStatus}`}>{SOCKET_LABEL[socketStatus]}</span>
        </div>
      </header>

      <ErrorBox error={report.error} onRetry={report.reload} />
      <div className="kpis">
        <Kpi label="Asignados" value={t?.total} loading={report.loading} />
        <Kpi label="Entregados" value={t?.delivered} tone="ok" loading={report.loading} />
        <Kpi label="Fallidos" value={t?.failed} tone="bad" loading={report.loading} />
        <Kpi label="Pendientes" value={t?.pending} tone="warn" loading={report.loading} />
        <Kpi label="Efectividad" value={t ? fmtPct(t.effectiveness) : undefined} loading={report.loading} />
      </div>

      {!isToday && <p className="muted small">El mapa y la lista de repartidores muestran siempre la situación actual (hoy).</p>}

      <div className="dash-grid">
        <section className="card map-card">
          <ErrorBox error={live.error || zones.error} onRetry={live.reload} />
          <BaseMap className="map map-lg">
            <ZonesLayer zones={zones.data?.filter((z) => !zoneId || z.id === zoneId)} />
            {couriers
              .filter((c) => c.last)
              .map((c) => (
                <CircleMarker
                  key={c.courier.id}
                  center={[c.last!.lat, c.last!.lng]}
                  radius={9}
                  pathOptions={{ color: '#fff', weight: 2, fillColor: STATE_COLOR[c.state], fillOpacity: 1 }}
                >
                  <Popup>
                    <strong>{c.courier.name}</strong>
                    <br />
                    {STATE_LABEL[c.state]}
                    <br />
                    Avance: {c.progress.delivered + c.progress.failed}/{c.progress.total} ({c.progress.delivered} entregados,{' '}
                    {c.progress.failed} fallidos)
                    <br />
                    Batería: {fmtBattery(c.last!.battery)}
                    <br />
                    Última señal: {fmtTime(c.last!.recordedAt)} ({fmtAgo(c.last!.recordedAt)})
                  </Popup>
                </CircleMarker>
              ))}
            <FitBounds points={fitPoints} fitKey={fitKey} />
            <FlyTo target={flyTarget} />
          </BaseMap>
          <div className="legend">
            {(Object.keys(STATE_LABEL) as (keyof typeof STATE_LABEL)[]).map((s) => (
              <span key={s}>
                <i style={{ background: STATE_COLOR[s] }} /> {STATE_LABEL[s]}
              </span>
            ))}
          </div>
        </section>

        <aside className="dash-side">
          <section className="card">
            <h2>Repartidores</h2>
            {live.loading && !live.data ? (
              <Loading />
            ) : couriers.length === 0 ? (
              <Empty>No hay repartidores.</Empty>
            ) : (
              <ul className="courier-list">
                {couriers.map((c) => (
                  <li
                    key={c.courier.id}
                    className={c.last ? 'clickable' : ''}
                    onClick={() => c.last && setFlyTarget({ p: { lat: c.last.lat, lng: c.last.lng }, n: Date.now() })}
                  >
                    <div className="row-between">
                      <span>
                        <i className="dot" style={{ background: STATE_COLOR[c.state] }} /> {c.courier.name}
                      </span>
                      <small className="muted">
                        {c.progress.delivered + c.progress.failed}/{c.progress.total}
                      </small>
                    </div>
                    <ProgressBar done={c.progress.delivered} failed={c.progress.failed} total={c.progress.total} />
                    <small className="muted">
                      {STATE_LABEL[c.state]}
                      {c.last ? ` · ${fmtAgo(c.last.recordedAt)}` : ''}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>Alertas pendientes {alerts.data && alerts.data.length > 0 && <span className="pill bad">{alerts.data.length}</span>}</h2>
            <ErrorBox error={alerts.error || ackError} onRetry={alerts.reload} />
            {alerts.loading && !alerts.data ? (
              <Loading />
            ) : !alerts.data?.length ? (
              <Empty>Sin alertas pendientes.</Empty>
            ) : (
              <ul className="alert-list">
                {alerts.data.map((a) => (
                  <li key={a.id} className={`alert-item al-${a.type}`}>
                    <div>
                      <strong>{ALERT_LABEL[a.type]}</strong> · {a.courierName}
                      <br />
                      <small>{a.message}</small>
                      <br />
                      <small className="muted">{fmtAgo(a.createdAt)}</small>
                    </div>
                    <div className="col-actions">
                      {a.location && (
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => setFlyTarget({ p: a.location!, n: Date.now() })}
                          title="Ver en mapa"
                        >
                          📍
                        </button>
                      )}
                      <button className="btn btn-sm" onClick={() => ack(a)}>
                        Atender
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, loading }: { label: string; value: number | string | undefined; tone?: string; loading: boolean }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{loading && value === undefined ? '…' : (value ?? '—')}</span>
    </div>
  );
}
