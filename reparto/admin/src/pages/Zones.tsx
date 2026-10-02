import { useMemo, useState, type FormEvent } from 'react';
import { CircleMarker, Polygon, Polyline, Tooltip } from 'react-leaflet';
import { api, errorMessage } from '../api';
import { useAuth } from '../auth';
import { Empty, ErrorBox, Field, Loading } from '../components/common';
import { BaseMap, ClickHandler, FitBounds, ZonesLayer } from '../components/maps';
import { useAsync } from '../hooks';
import type { LatLng, Zone } from '../types';

const PALETTE = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777'];

export default function ZonesPage() {
  const { isAdmin } = useAuth();
  const zones = useAsync(() => api.zones(), []);
  const [editingId, setEditingId] = useState<string | null>(null); // null = nueva
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [vertices, setVertices] = useState<LatLng[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ points: LatLng[]; key: string } | null>(null);

  const others = useMemo(() => zones.data?.filter((z) => z.id !== editingId), [zones.data, editingId]);
  // Al inicio se encuadran todas las zonas; al seleccionar una, solo esa.
  const allPoints = useMemo(() => (zones.data ?? []).flatMap((z) => z.polygon), [zones.data]);
  const fitPoints = focus?.points ?? allPoints;
  const fitKey = focus?.key ?? `all-${zones.data ? 1 : 0}`;
  const focusZone = (z: Zone) => setFocus({ points: z.polygon, key: `${z.id}-${Date.now()}` });

  function startNew() {
    setEditingId(null);
    setName('');
    setColor(PALETTE[(zones.data?.length ?? 0) % PALETTE.length]);
    setVertices([]);
    setError(null);
  }

  function edit(z: Zone) {
    setEditingId(z.id);
    setName(z.name);
    setColor(z.color);
    setVertices(z.polygon);
    setError(null);
    setNotice(null);
    focusZone(z);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (vertices.length < 3) {
      setError('El polígono necesita al menos 3 vértices. Haz clic en el mapa para agregarlos.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), color, polygon: vertices };
      const z = editingId ? await api.updateZone(editingId, body) : await api.createZone(body);
      zones.setData((prev) => {
        const list = prev ?? [];
        return list.some((x) => x.id === z.id) ? list.map((x) => (x.id === z.id ? z : x)) : [...list, z];
      });
      setNotice(`Zona “${z.name}” guardada.`);
      setEditingId(z.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(z: Zone) {
    if (!window.confirm(`¿Eliminar la zona “${z.name}”?`)) return;
    setError(null);
    try {
      await api.deleteZone(z.id);
      zones.setData((prev) => prev?.filter((x) => x.id !== z.id));
      if (editingId === z.id) startNew();
      setNotice(`Zona “${z.name}” eliminada.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const latLngs = vertices.map((v) => [v.lat, v.lng] as [number, number]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Zonas</h1>
        {isAdmin && (
          <button className="btn btn-primary" onClick={startNew}>
            Nueva zona
          </button>
        )}
      </header>
      {notice && (
        <div className="ok-box" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}
      <ErrorBox error={zones.error} onRetry={zones.reload} />
      <div className="dash-grid">
        <section className="card map-card">
          {isAdmin && (
            <p className="small muted">
              {editingId ? 'Editando zona. ' : 'Nueva zona. '}Haz clic en el mapa para agregar vértices ({vertices.length}).
            </p>
          )}
          <BaseMap className="map map-lg">
            <ZonesLayer zones={isAdmin ? others : zones.data} />
            {isAdmin && <ClickHandler onClick={(p) => setVertices((v) => [...v, p])} />}
            {isAdmin && vertices.length >= 3 && <Polygon positions={latLngs} pathOptions={{ color, fillColor: color, fillOpacity: 0.25, weight: 3 }} />}
            {isAdmin && vertices.length === 2 && <Polyline positions={latLngs} pathOptions={{ color, weight: 3, dashArray: '6 6' }} />}
            {isAdmin &&
              vertices.map((v, i) => (
                <CircleMarker key={i} center={[v.lat, v.lng]} radius={5} pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }}>
                  <Tooltip>Vértice {i + 1}</Tooltip>
                </CircleMarker>
              ))}
            <FitBounds points={fitPoints} fitKey={fitKey} />
          </BaseMap>
        </section>

        <aside className="dash-side">
          {isAdmin && (
            <section className="card">
              <h2>{editingId ? 'Editar zona' : 'Nueva zona'}</h2>
              <form className="form" onSubmit={save}>
                <Field label="Nombre *">
                  <input value={name} onChange={(e) => setName(e.target.value)} required />
                </Field>
                <Field label="Color">
                  <div className="color-row">
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                    {PALETTE.map((c) => (
                      <button key={c} type="button" className="swatch" style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
                    ))}
                  </div>
                </Field>
                <div className="btn-group">
                  <button type="button" className="btn btn-sm" onClick={() => setVertices((v) => v.slice(0, -1))} disabled={!vertices.length}>
                    Deshacer último
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => setVertices([])} disabled={!vertices.length}>
                    Limpiar
                  </button>
                </div>
                <ErrorBox error={error} />
                <div className="form-actions">
                  {editingId && (
                    <button type="button" className="btn" onClick={startNew}>
                      Cancelar
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? 'Guardando…' : 'Guardar zona'}
                  </button>
                </div>
              </form>
            </section>
          )}
          <section className="card">
            <h2>Zonas activas</h2>
            {zones.loading && !zones.data ? (
              <Loading />
            ) : !zones.data?.length ? (
              <Empty>No hay zonas.</Empty>
            ) : (
              <ul className="zone-list">
                {zones.data.map((z) => (
                  <li key={z.id} className={z.id === editingId ? 'selected' : ''}>
                    <span className="clickable" onClick={() => (isAdmin ? edit(z) : focusZone(z))}>
                      <i className="dot" style={{ background: z.color }} /> {z.name}{' '}
                      <small className="muted">({z.polygon.length} vértices)</small>
                    </span>
                    {isAdmin && (
                      <span className="btn-group">
                        <button className="btn btn-sm" onClick={() => edit(z)}>
                          Editar
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => remove(z)}>
                          Eliminar
                        </button>
                      </span>
                    )}
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
