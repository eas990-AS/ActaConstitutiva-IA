import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { CourierSelect, Drawer, Empty, ErrorBox, Loading, StatusBadge, ZoneSelect } from '../components/common';
import PackageDetail from '../components/PackageDetail';
import { useAsync, useLookups } from '../hooks';
import { STATUSES, STATUS_LABEL } from '../labels';
import type { PackageStatus } from '../types';
import { fmtTime, today } from '../utils';

export default function DeliveriesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { zones, couriers, zoneName, courierName } = useLookups();
  const [date, setDate] = useState(today());
  const [zoneId, setZoneId] = useState('');
  const [courierId, setCourierId] = useState('');
  const [status, setStatus] = useState<PackageStatus | ''>('');
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const pkgs = useAsync(
    () => api.packages({ date, zoneId: zoneId || undefined, courierId: courierId || undefined, status }),
    [date, zoneId, courierId, status],
  );

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

  return (
    <div className="page">
      <header className="page-head">
        <h1>Entregas</h1>
        <div className="filters">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
          <ZoneSelect zones={zones.data} value={zoneId} onChange={setZoneId} />
          <CourierSelect couriers={couriers.data} value={courierId} onChange={setCourierId} />
          <select value={status} onChange={(e) => setStatus(e.target.value as PackageStatus | '')}>
            <option value="">Todos los estados</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button className="btn" onClick={exportCsv} disabled={csvBusy} title="Exporta el reporte del día (fecha y zona)">
            {csvBusy ? 'Descargando…' : 'Exportar CSV'}
          </button>
        </div>
      </header>
      <ErrorBox error={csvError} />
      <ErrorBox error={pkgs.error} onRetry={pkgs.reload} />

      <section className="card">
        {pkgs.loading && !pkgs.data ? (
          <Loading />
        ) : !pkgs.data?.length ? (
          <Empty>No hay paquetes con estos filtros.</Empty>
        ) : (
          <>
            <p className="muted small">{pkgs.data.length} paquetes{pkgs.loading ? ' · actualizando…' : ''}</p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Guía</th>
                    <th>Destinatario</th>
                    <th>Dirección</th>
                    <th>Zona</th>
                    <th>Repartidor</th>
                    <th>Estado</th>
                    <th>Intentos</th>
                    <th>Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {pkgs.data.map((p) => (
                    <tr key={p.id} className={`clickable${p.id === id ? ' selected' : ''}`} onClick={() => navigate(`/entregas/${p.id}`)}>
                      <td>
                        <strong>{p.trackingCode}</strong>
                      </td>
                      <td>{p.recipientName}</td>
                      <td className="ellipsis" title={p.address}>
                        {p.address}
                      </td>
                      <td>{zoneName(p.zoneId)}</td>
                      <td>{courierName(p.courierId)}</td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="num">{p.attempts}</td>
                      <td>{fmtTime(p.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <Drawer open={!!id} title="Detalle del paquete" onClose={() => navigate('/entregas')}>
        {id && <PackageDetail id={id} courierName={courierName} zoneName={zoneName} />}
      </Drawer>
    </div>
  );
}
