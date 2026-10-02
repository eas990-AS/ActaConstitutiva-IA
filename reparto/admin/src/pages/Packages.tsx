import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleMarker } from 'react-leaflet';
import { api, errorMessage } from '../api';
import { Empty, ErrorBox, Field, Loading, StatusBadge } from '../components/common';
import { BaseMap, ClickHandler, ZonesLayer } from '../components/maps';
import { useAsync, useLookups } from '../hooks';
import type { CreatePackageBody, ImportResult, LatLng } from '../types';
import { downloadText, today } from '../utils';

const CSV_HEADER = 'trackingCode,recipientName,recipientPhone,address,lat,lng,notes,scheduledDate';

function sampleCsv(): string {
  const d = today();
  return [
    CSV_HEADER,
    `GUIA-0001,Juan Pérez,5512345678,"Av. Insurgentes Sur 1234, Col. Del Valle, CDMX",19.3727,-99.1781,Tocar el timbre,${d}`,
    `GUIA-0002,María López,,"Calle Durango 200, Col. Roma Norte, CDMX",,,,${d}`,
  ].join('\n');
}

export default function PackagesPage() {
  const navigate = useNavigate();
  const { zones, zoneName, courierName } = useLookups();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const list = useAsync(() => api.packages({ q: debouncedQ || undefined, date: date || undefined }), [debouncedQ, date]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Paquetes</h1>
      </header>

      <div className="grid-2">
        <CreatePackageForm zones={zones.data} onCreated={list.reload} />
        <ImportCsv onImported={list.reload} />
      </div>

      <section className="card">
        <div className="row-between">
          <h2>Listado</h2>
          <div className="filters">
            <input type="search" placeholder="Buscar guía, destinatario o dirección…" value={q} onChange={(e) => setQ(e.target.value)} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} title="Fecha programada (opcional)" />
            {date && (
              <button className="btn btn-sm btn-ghost" onClick={() => setDate('')}>
                Todas las fechas
              </button>
            )}
          </div>
        </div>
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data?.length ? (
          <Empty>No se encontraron paquetes.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Guía</th>
                  <th>Destinatario</th>
                  <th>Dirección</th>
                  <th>Fecha</th>
                  <th>Zona</th>
                  <th>Repartidor</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => navigate(`/entregas/${p.id}`)}>
                    <td>
                      <strong>{p.trackingCode}</strong>
                    </td>
                    <td>{p.recipientName}</td>
                    <td className="ellipsis" title={p.address}>
                      {p.address}
                    </td>
                    <td>{p.scheduledDate}</td>
                    <td>{zoneName(p.zoneId)}</td>
                    <td>{courierName(p.courierId)}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const EMPTY_FORM = { trackingCode: '', recipientName: '', recipientPhone: '', address: '', notes: '' };

function CreatePackageForm({ zones, onCreated }: { zones: Parameters<typeof ZonesLayer>[0]['zones']; onCreated: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [scheduledDate, setScheduledDate] = useState(today());
  const [location, setLocation] = useState<LatLng | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    const body: CreatePackageBody = {
      trackingCode: form.trackingCode.trim(),
      recipientName: form.recipientName.trim(),
      address: form.address.trim(),
      scheduledDate,
    };
    if (form.recipientPhone.trim()) body.recipientPhone = form.recipientPhone.trim();
    if (form.notes.trim()) body.notes = form.notes.trim();
    if (location) body.location = location;
    try {
      const p = await api.createPackage(body);
      setOk(`Paquete ${p.trackingCode} creado${p.courierId ? ' y asignado automáticamente' : ''}.`);
      setForm(EMPTY_FORM);
      setLocation(null);
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Nuevo paquete</h2>
      <form className="form form-grid" onSubmit={submit}>
        <Field label="Guía *">
          <input value={form.trackingCode} onChange={set('trackingCode')} required />
        </Field>
        <Field label="Fecha programada *">
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required />
        </Field>
        <Field label="Destinatario *">
          <input value={form.recipientName} onChange={set('recipientName')} required />
        </Field>
        <Field label="Teléfono">
          <input value={form.recipientPhone} onChange={set('recipientPhone')} inputMode="tel" />
        </Field>
        <Field label="Dirección *" wide>
          <input value={form.address} onChange={set('address')} required />
        </Field>
        <Field label="Notas" wide>
          <input value={form.notes} onChange={set('notes')} />
        </Field>
        <div className="wide">
          <div className="row-between">
            <small className="muted">
              Ubicación (opcional): haz clic en el mapa.{' '}
              {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Sin ubicación.'}
            </small>
            {location && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setLocation(null)}>
                Quitar ubicación
              </button>
            )}
          </div>
          <BaseMap className="map map-sm">
            <ZonesLayer zones={zones} />
            <ClickHandler onClick={setLocation} />
            {location && (
              <CircleMarker center={[location.lat, location.lng]} radius={9} pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.9 }} />
            )}
          </BaseMap>
        </div>
        <div className="wide">
          <ErrorBox error={error} />
          {ok && <div className="ok-box">{ok}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Guardando…' : 'Crear paquete'}
          </button>
        </div>
      </form>
    </section>
  );
}

function ImportCsv({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.importPackages(file);
      setResult(r);
      if (r.created > 0) onImported();
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Importar CSV</h2>
      <p className="small">
        Archivo UTF-8 separado por comas con este encabezado obligatorio:
      </p>
      <code className="code-block">{CSV_HEADER}</code>
      <p className="small muted">
        <code>lat</code>, <code>lng</code>, <code>recipientPhone</code> y <code>notes</code> pueden ir vacíos. <code>scheduledDate</code> en
        formato AAAA-MM-DD. Si el paquete trae coordenadas se asigna automáticamente a la zona y repartidor correspondiente.
      </p>
      <button type="button" className="btn btn-sm" onClick={() => downloadText(sampleCsv(), 'ejemplo-paquetes.csv')}>
        Descargar CSV de ejemplo
      </button>
      <form className="form" onSubmit={submit}>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button className="btn btn-primary" type="submit" disabled={!file || busy}>
          {busy ? 'Importando…' : 'Importar'}
        </button>
      </form>
      <ErrorBox error={error} />
      {result && (
        <div className="import-result">
          <div className="ok-box">Paquetes creados: {result.created}</div>
          {result.errors.length > 0 && (
            <>
              <p className="text-bad">{result.errors.length} renglones con errores:</p>
              <table className="table compact">
                <thead>
                  <tr>
                    <th>Línea</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((er, i) => (
                    <tr key={i}>
                      <td className="num">{er.line}</td>
                      <td>{er.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </section>
  );
}
