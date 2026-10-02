import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';
import { ROLE_LABEL } from '../labels';

const LINKS = [
  { to: '/', label: 'Hoy', end: true },
  { to: '/entregas', label: 'Entregas' },
  { to: '/no-entregados', label: 'No entregados' },
  { to: '/paquetes', label: 'Paquetes' },
  { to: '/repartidores', label: 'Repartidores' },
  { to: '/zonas', label: 'Zonas' },
  { to: '/reportes', label: 'Reportes' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">📦 Reparto</div>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {l.label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <div className="me">
            <strong>{user?.name}</strong>
            <small>{user ? ROLE_LABEL[user.role] : ''}</small>
          </div>
          <button className="btn btn-sm" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
