import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api';
import { Empty, ErrorBox, Loading } from '../components/common';
import { useAsync } from '../hooks';
import { fmtDateTime, fmtKm } from '../utils';

export default function CourierRoutesPage() {
  const { courierId = '' } = useParams();
  const location = useLocation();
  const stateName = (location.state as { name?: string } | null)?.name;
  const [date, setDate] = useState('');
  const couriers = useAsync(() => (stateName ? Promise.resolve([]) : api.users({ role: 'COURIER' })), [stateName]);
  const routes = useAsync(() => api.routes({ courierId, date: date || undefined }), [courierId, date]);
  const name = stateName ?? couriers.data?.find((c) => c.id === courierId)?.name ?? 'Repartidor';

  const sorted = [...(routes.data ?? [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <Link to="/repartidores" className="small">
            ← Repartidores
          </Link>
          <h1>Recorridos de {name}</h1>
        </div>
        <div className="filters">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} title="Filtrar por fecha (opcional)" />
          {date && (
            <button className="btn btn-sm btn-ghost" onClick={() => setDate('')}>
              Todas las fechas
            </button>
          )}
        </div>
      </header>
      <ErrorBox error={routes.error} onRetry={routes.reload} />
      <section className="card">
        {routes.loading && !routes.data ? (
          <Loading />
        ) : sorted.length === 0 ? (
          <Empty>Sin recorridos registrados.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Distancia</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{fmtDateTime(r.startedAt)}</td>
                  <td>{r.endedAt ? fmtDateTime(r.endedAt) : <span className="badge st-IN_ROUTE">En curso</span>}</td>
                  <td className="num">{fmtKm(r.distanceKm)}</td>
                  <td>
                    <Link className="btn btn-sm" to={`/recorridos/${r.id}`} state={{ name }}>
                      Ver trayecto
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
