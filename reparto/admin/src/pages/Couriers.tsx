import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { useAuth } from '../auth';
import { Empty, ErrorBox, Field, Loading, Modal, ZoneSelect } from '../components/common';
import { useAsync } from '../hooks';
import { ROLE_LABEL } from '../labels';
import type { Role, UpdateUserBody, User, Zone } from '../types';

export default function CouriersPage() {
  const { isAdmin } = useAuth();
  const zones = useAsync(() => api.zones(), []);
  // SUPERVISOR solo puede consultar repartidores.
  const users = useAsync(() => (isAdmin ? api.users() : api.users({ role: 'COURIER' })), [isAdmin]);
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [editing, setEditing] = useState<User | 'new' | null>(null);

  const zoneName = (id: string | null) => (id ? (zones.data?.find((z) => z.id === id)?.name ?? '—') : 'Sin zona');
  const rows = useMemo(
    () =>
      (users.data ?? [])
        .filter((u) => u.role !== 'ADMIN')
        .filter((u) => !roleFilter || u.role === roleFilter)
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [users.data, roleFilter],
  );

  function saved(u: User) {
    setEditing(null);
    users.setData((prev) => {
      const list = prev ?? [];
      return list.some((x) => x.id === u.id) ? list.map((x) => (x.id === u.id ? u : x)) : [...list, u];
    });
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Repartidores</h1>
        <div className="filters">
          {isAdmin && (
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | '')}>
              <option value="">Repartidores y supervisores</option>
              <option value="COURIER">Solo repartidores</option>
              <option value="SUPERVISOR">Solo supervisores</option>
            </select>
          )}
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              Nuevo usuario
            </button>
          )}
        </div>
      </header>
      <ErrorBox error={users.error} onRetry={users.reload} />
      <section className="card">
        {users.loading && !users.data ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>No hay usuarios.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Teléfono</th>
                  <th>Zona</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className={u.active ? '' : 'inactive'}>
                    <td>{u.name}</td>
                    <td>{u.username}</td>
                    <td>{ROLE_LABEL[u.role]}</td>
                    <td>{u.phone ?? '—'}</td>
                    <td>{zoneName(u.zoneId)}</td>
                    <td>{u.active ? <span className="badge st-DELIVERED">Activo</span> : <span className="badge st-RETURNED">Inactivo</span>}</td>
                    <td>
                      <div className="btn-group">
                        {u.role === 'COURIER' && (
                          <Link className="btn btn-sm" to={`/repartidores/${u.id}/recorridos`} state={{ name: u.name }}>
                            Recorridos
                          </Link>
                        )}
                        {isAdmin && (
                          <button className="btn btn-sm" onClick={() => setEditing(u)}>
                            Editar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && isAdmin && (
        <UserForm user={editing === 'new' ? null : editing} zones={zones.data} onClose={() => setEditing(null)} onSaved={saved} />
      )}
    </div>
  );
}

function UserForm({
  user,
  zones,
  onClose,
  onSaved,
}: {
  user: User | null;
  zones: Zone[] | undefined;
  onClose: () => void;
  onSaved: (u: User) => void;
}) {
  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(user?.role ?? 'COURIER');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [zoneId, setZoneId] = useState(user?.zoneId ?? '');
  const [active, setActive] = useState(user?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let u: User;
      if (!user) {
        u = await api.createUser({
          name: name.trim(),
          username: username.trim(),
          password,
          role,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(zoneId ? { zoneId } : {}),
        });
      } else {
        const body: UpdateUserBody = {};
        if (name.trim() !== user.name) body.name = name.trim();
        if (password) body.password = password;
        if (phone.trim() !== (user.phone ?? '')) body.phone = phone.trim();
        if (zoneId !== (user.zoneId ?? '')) body.zoneId = zoneId || null;
        if (active !== user.active) body.active = active;
        u = Object.keys(body).length ? await api.updateUser(user.id, body) : user;
      }
      onSaved(u);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal open title={user ? `Editar ${user.name}` : 'Nuevo usuario'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Nombre *">
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Usuario *">
          <input value={username} onChange={(e) => setUsername(e.target.value)} required disabled={!!user} autoComplete="off" />
        </Field>
        <Field label={user ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!user} autoComplete="new-password" />
        </Field>
        <Field label="Rol">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={!!user}>
            <option value="COURIER">{ROLE_LABEL.COURIER}</option>
            <option value="SUPERVISOR">{ROLE_LABEL.SUPERVISOR}</option>
          </select>
        </Field>
        <Field label="Teléfono">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </Field>
        <Field label="Zona">
          <ZoneSelect zones={zones} value={zoneId} onChange={setZoneId} allLabel="Sin zona" />
        </Field>
        {user && (
          <label className="check">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Activo
          </label>
        )}
        <ErrorBox error={error} />
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
