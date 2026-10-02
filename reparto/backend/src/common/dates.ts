/** Zona horaria de operación (define qué es "hoy"). */
export const OPERATION_TZ = process.env.TZ || 'America/Mexico_City';

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: OPERATION_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 'YYYY-MM-DD' del instante dado en la zona horaria de operación. */
export function operationDate(at: Date = new Date()): string {
  return fmt.format(at);
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** Intervalo UTC holgado que contiene el día de operación (para prefiltrar en BD). */
export function looseUtcRange(date: string): { gte: Date; lt: Date } {
  const base = new Date(`${date}T00:00:00Z`).getTime();
  return { gte: new Date(base - 86_400_000), lt: new Date(base + 2 * 86_400_000) };
}
