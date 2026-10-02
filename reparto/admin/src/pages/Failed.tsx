import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage, resolveUrl } from '../api';
import { CourierSelect, Empty, ErrorBox, Field, Loading, Modal, ZoneSelect } from '../components/common';
import { useAsync, useLookups } from '../hooks';
import { FAIL_REASON_LABEL } from '../labels';
import type { DeliveryAttempt, PackageDetail } from '../types';
import { addDays, fmtDateTime, today } from '../utils';

type Action = { kind: 'reschedule' | 'assign' | 'return'; pkg: PackageDetail };

function lastFailed(p: PackageDetail): DeliveryAttempt | undefined {
  return [...p.history].filter((a) => a.result === 'FAILED').sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
}

export default function FailedPage() {
  const { zones, couriers, zoneName, courierName } = useLookups();
  const [date, setDate] = useState(today());
  const [zoneId, setZoneId] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // La lista no trae el historial; se consulta el detalle de cada paquete para mostrar el último intento.
  const list = useAsync(async () => {
    const pkgs = await api.packages({ date, status: 'FAILED', zoneId: zoneId || undefined });
    return Promise.all(pkgs.map((p) => api.package(p.id)));
  }, [date, zoneId]);

  function done(msg: string, id: string) {
    setAction(null);
    setNotice(msg);
    // Reprogramar/devolver sacan el paquete de FAILED; reasignar puede dejarlo igual: se recarga la lista.
    list.setData((prev) => prev?.filter((p) => p.id !== id));
    list.reload();
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>No entregados</h1>
        <div className="filters">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
          <ZoneSelect zones={zones.data} value={zoneId} onChange={setZoneId} />
        </div>
      </header>
      {notice && (
        <div className="ok-box" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}
      <ErrorBox error={list.error} onRetry={list.reload} />
      <section className="card">
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data?.length ? (
          <Empty>No hay paquetes no entregados para esta fecha.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fachada</th>
                  <th>Guía</th>
                  <th>Destinatario / dirección</th>
                  <th>Repartidor</th>
                  <th>Motivo</th>
                  <th>Intentos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((p) => {
                  const a = lastFailed(p);
                  const facade = a?.evidences.find((e) => e.kind === 'FACADE_PHOTO') ?? a?.evidences[0];
                  return (
                    <tr key={p.id}>
                      <td>
                        {facade ? (
                          <a href={resolveUrl(facade.url)} target="_blank" rel="noreferrer">
                            <img className="thumb" src={resolveUrl(facade.url)} alt="Fachada" loading="lazy" />
                          </a>
                        ) : (
                          <span className="thumb empty-thumb">Sin foto</span>
                        )}
                      </td>
                      <td>
                        <Link to={`/entregas/${p.id}`}>
                          <strong>{p.trackingCode}</strong>
                        </Link>
                      </td>
                      <td>
                        {p.recipientName}
                        <br />
                        <small className="muted">{p.address}</small>
                      </td>
                      <td>
                        {courierName(p.courierId)}
                        <br />
                        <small className="muted">{zoneName(p.zoneId)}</small>
                      </td>
                      <td>
                        {a?.failReason ? FAIL_REASON_LABEL[a.failReason] : '—'}
                        {a?.comment && (
                          <>
                            <br />
                            <small className="muted">“{a.comment}”</small>
                          </>
                        )}
                        {a && (
                          <>
                            <br />
                            <small className="muted">{fmtDateTime(a.occurredAt)}</small>
                          </>
                        )}
                      </td>
                      <td className="num">{p.attempts}</td>
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-sm btn-primary" onClick={() => setAction({ kind: 'reschedule', pkg: p })}>
                            Reprogramar
                          </button>
                          <button className="btn btn-sm" onClick={() => setAction({ kind: 'assign', pkg: p })}>
                            Reasignar
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => setAction({ kind: 'return', pkg: p })}>
                            Devolver
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {action && (
        <ActionModal
          action={action}
          couriers={couriers.data}
          onClose={() => setAction(null)}
          onDone={(msg) => done(msg, action.pkg.id)}
        />
      )}
    </div>
  );
}

function ActionModal({
  action,
  couriers,
  onClose,
  onDone,
}: {
  action: Action;
  couriers: Parameters<typeof CourierSelect>[0]['couriers'];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const { kind, pkg } = action;
  const [date, setDate] = useState(addDays(today(), 1));
  const [courierId, setCourierId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title =
    kind === 'reschedule' ? `Reprogramar ${pkg.trackingCode}` : kind === 'assign' ? `Reasignar ${pkg.trackingCode}` : `Devolver ${pkg.trackingCode}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (kind === 'reschedule') {
        await api.reschedule(pkg.id, date, courierId || undefined);
        onDone(`Paquete ${pkg.trackingCode} reprogramado para el ${date}.`);
      } else if (kind === 'assign') {
        if (!courierId) throw new Error('Selecciona un repartidor.');
        await api.assign(pkg.id, courierId);
        onDone(`Paquete ${pkg.trackingCode} reasignado.`);
      } else {
        await api.returnPackage(pkg.id);
        onDone(`Paquete ${pkg.trackingCode} marcado como devuelto al remitente.`);
      }
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal open title={title} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {kind === 'reschedule' && (
          <>
            <Field label="Nueva fecha">
              <input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <Field label="Repartidor (opcional)">
              <CourierSelect couriers={couriers} value={courierId} onChange={setCourierId} allLabel="Mantener el actual" onlyActive />
            </Field>
          </>
        )}
        {kind === 'assign' && (
          <Field label="Nuevo repartidor">
            <CourierSelect couriers={couriers} value={courierId} onChange={setCourierId} allLabel="Selecciona…" onlyActive />
          </Field>
        )}
        {kind === 'return' && <p>¿Confirmas que el paquete se devolverá al remitente? Esta acción es definitiva.</p>}
        <ErrorBox error={error} />
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={`btn ${kind === 'return' ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>
            {busy ? 'Guardando…' : kind === 'reschedule' ? 'Reprogramar' : kind === 'assign' ? 'Reasignar' : 'Devolver'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
