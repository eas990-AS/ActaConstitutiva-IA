import { useState } from 'react';
import { api, errorMessage } from '../api';
import { Empty, ErrorBox, Loading, ZoneSelect } from '../components/common';
import { useAsync } from '../hooks';
import { FAIL_REASON_LABEL } from '../labels';
import type { Totals } from '../types';
import { fmtKm, fmtPct, today } from '../utils';

function TotalsCells({ t }: { t: Totals }) {
  return (
    <>
      <td className="num">{t.total}</td>
      <td className="num text-ok">{t.delivered}</td>
      <td className="num text-bad">{t.failed}</td>
      <td className="num">{t.pending}</td>
      <td className="num">{t.returned}</td>
      <td className="num">
        <strong>{fmtPct(t.effectiveness)}</strong>
      </td>
    </>
  );
}

const TOTALS_HEAD = (
  <>
    <th className="num">Total</th>
    <th className="num">Entregados</th>
    <th className="num">Fallidos</th>
    <th className="num">Pendientes</th>
    <th className="num">Devueltos</th>
    <th className="num">Efectividad</th>
  </>
);

export default function ReportsPage() {
  const [date, setDate] = useState(today());
  const [zoneId, setZoneId] = useState('');
  const zones = useAsync(() => api.zones(), []);
  const report = useAsync(() => api.dailyReport(date, zoneId || undefined), [date, zoneId]);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  async function exportCsv() {
    setCsvBusy(true);
    setCsvError(null);
    try {
      await api.downloadDailyCsv(date, zoneId || undefined);
    } catch (e) {
      setCsvError(errorMessage(e));
    } finally {
      setCsvBusy(false);
    }
  }

  const r = report.data;
  const maxReason = Math.max(1, ...(r?.failureReasons.map((f) => f.count) ?? [0]));
  const totalReasons = r?.failureReasons.reduce((s, f) => s + f.count, 0) ?? 0;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Reportes</h1>
        <div className="filters">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
          <ZoneSelect zones={zones.data} value={zoneId} onChange={setZoneId} />
          <button className="btn" onClick={exportCsv} disabled={csvBusy}>
            {csvBusy ? 'Descargando…' : 'Exportar CSV'}
          </button>
        </div>
      </header>
      <ErrorBox error={csvError} />
      <ErrorBox error={report.error} onRetry={report.reload} />
      {report.loading && !r ? (
        <Loading />
      ) : (
        r && (
          <>
            <div className="kpis">
              <div className="kpi">
                <span className="kpi-label">Total</span>
                <span className="kpi-value">{r.totals.total}</span>
              </div>
              <div className="kpi ok">
                <span className="kpi-label">Entregados</span>
                <span className="kpi-value">{r.totals.delivered}</span>
              </div>
              <div className="kpi bad">
                <span className="kpi-label">Fallidos</span>
                <span className="kpi-value">{r.totals.failed}</span>
              </div>
              <div className="kpi warn">
                <span className="kpi-label">Pendientes</span>
                <span className="kpi-value">{r.totals.pending}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Devueltos</span>
                <span className="kpi-value">{r.totals.returned}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Efectividad</span>
                <span className="kpi-value">{fmtPct(r.totals.effectiveness)}</span>
              </div>
            </div>

            <section className="card">
              <h2>Por zona</h2>
              {r.byZone.length === 0 ? (
                <Empty>Sin datos.</Empty>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Zona</th>
                        {TOTALS_HEAD}
                      </tr>
                    </thead>
                    <tbody>
                      {r.byZone.map((z) => (
                        <tr key={z.zoneId ?? 'none'}>
                          <td>{z.zoneName || 'Sin zona'}</td>
                          <TotalsCells t={z} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card">
              <h2>Por repartidor</h2>
              {r.byCourier.length === 0 ? (
                <Empty>Sin datos.</Empty>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Repartidor</th>
                        {TOTALS_HEAD}
                        <th className="num">Recorrido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...r.byCourier]
                        .sort((a, b) => b.effectiveness - a.effectiveness)
                        .map((c) => (
                          <tr key={c.courierId}>
                            <td>{c.courierName}</td>
                            <TotalsCells t={c} />
                            <td className="num">{fmtKm(c.distanceKm)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card">
              <h2>Motivos de no entrega</h2>
              {r.failureReasons.length === 0 ? (
                <Empty>Sin entregas fallidas.</Empty>
              ) : (
                <div className="bars">
                  {[...r.failureReasons]
                    .sort((a, b) => b.count - a.count)
                    .map((f) => (
                      <div key={f.reason} className="bar-row">
                        <span className="bar-label">{FAIL_REASON_LABEL[f.reason]}</span>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${(f.count / maxReason) * 100}%` }} />
                        </div>
                        <span className="bar-value">
                          {f.count} <small className="muted">({fmtPct(totalReasons ? f.count / totalReasons : 0)})</small>
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}
