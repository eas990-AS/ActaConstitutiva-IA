import { useEffect, type ReactNode } from 'react';
import { STATUS_LABEL } from '../labels';
import type { PackageStatus, User, Zone } from '../types';

export function ErrorBox({ error, onRetry }: { error: string | null | undefined; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="error-box" role="alert">
      <span>{error}</span>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Loading({ text = 'Cargando…' }: { text?: string }) {
  return (
    <div className="loading">
      <span className="spinner" /> {text}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function StatusBadge({ status }: { status: PackageStatus }) {
  return <span className={`badge st-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="drawer-backdrop center" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}

export function ZoneSelect({
  zones,
  value,
  onChange,
  allLabel = 'Todas las zonas',
}: {
  zones: Zone[] | undefined;
  value: string;
  onChange: (v: string) => void;
  allLabel?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allLabel}</option>
      {zones?.map((z) => (
        <option key={z.id} value={z.id}>
          {z.name}
        </option>
      ))}
    </select>
  );
}

export function CourierSelect({
  couriers,
  value,
  onChange,
  allLabel = 'Todos los repartidores',
  onlyActive = false,
}: {
  couriers: User[] | undefined;
  value: string;
  onChange: (v: string) => void;
  allLabel?: string;
  onlyActive?: boolean;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allLabel}</option>
      {couriers
        ?.filter((c) => !onlyActive || c.active)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.active ? '' : ' (inactivo)'}
          </option>
        ))}
    </select>
  );
}

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field${wide ? ' wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function ProgressBar({ done, failed, total }: { done: number; failed: number; total: number }) {
  const pct = (n: number) => (total > 0 ? `${(n / total) * 100}%` : '0%');
  return (
    <div className="progress" title={`${done} entregados, ${failed} fallidos de ${total}`}>
      <div className="progress-ok" style={{ width: pct(done) }} />
      <div className="progress-fail" style={{ width: pct(failed) }} />
    </div>
  );
}
