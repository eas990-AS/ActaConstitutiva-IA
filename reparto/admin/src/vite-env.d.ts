/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origen del backend sin /api (p. ej. http://localhost:3000). Vacío = mismo origen. */
  readonly VITE_API_URL?: string;
  /** Zona horaria de los días de operación. Por defecto America/Mexico_City. */
  readonly VITE_TZ?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
