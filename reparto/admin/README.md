# Reparto · Panel de administración

Panel web para administradores y supervisores del sistema de rastreo de entregas.
Implementa el contrato de `../docs/API.md`.

**Stack:** Vite + React 18 + TypeScript (estricto) + React Router + Leaflet (react-leaflet, mosaicos de
OpenStreetMap, sin API key) + socket.io-client. CSS plano (`src/styles.css`).

## Requisitos

- Node.js 18 o superior
- El backend (`../backend`) escuchando en `http://localhost:3000`

## Cómo ejecutar

```bash
cd reparto/admin
npm install
npm run dev          # http://localhost:5173
```

En desarrollo, Vite redirige `/api` y `/socket.io` (WebSocket incluido) a `http://localhost:3000`.
Para usar otro backend con el proxy: `BACKEND_URL=http://otro-host:3000 npm run dev`.

Usuarios de prueba (semilla del backend): `admin` / `admin123` y `supervisor` / `super123`.
Los repartidores (rol COURIER) no pueden entrar al panel.

### Otros comandos

```bash
npm run typecheck    # tsc --noEmit
npm run build        # verificación de tipos + compilación a dist/
npm run preview      # sirve dist/ localmente
```

## Variables de entorno (opcionales)

Copia `.env.example` a `.env.local`:

| Variable | Descripción |
| --- | --- |
| `VITE_API_URL` | Origen del backend **sin** `/api` (p. ej. `https://api.midominio.mx`). Vacío = mismo origen. |
| `VITE_TZ` | Zona horaria de los días de operación (por defecto `America/Mexico_City`, igual que el servidor). |

Si se publica `dist/` en otro dominio que el backend, define `VITE_API_URL` y habilita CORS en el
backend. El servidor web debe redirigir cualquier ruta a `index.html` (SPA).

## Secciones

- **Hoy:** indicadores del día, mapa en vivo de repartidores (Socket.IO), zonas, avance y alertas.
- **Entregas:** paquetes por día con filtros, detalle con historial, evidencias y mapa; exportación CSV.
- **No entregados:** paquetes fallidos con motivo y foto de fachada; reprogramar, reasignar o devolver.
- **Paquetes:** alta individual (con ubicación en mapa), importación CSV y búsqueda.
- **Repartidores:** alta/edición de usuarios (solo ADMIN) e historial de recorridos con trayecto en mapa.
- **Zonas:** dibujo de polígonos en el mapa (solo ADMIN edita).
- **Reportes:** resumen por zona, por repartidor y motivos de no entrega; exportación CSV.

## Estructura

```
src/
  api.ts            cliente HTTP tipado (token, 401 → login, descargas)
  types.ts          tipos del contrato
  labels.ts         etiquetas en español de los enums
  socket.ts         conexión al namespace /live
  auth.tsx          contexto de sesión
  hooks.ts          useAsync y catálogos (zonas, repartidores)
  utils.ts          fechas y formatos
  components/       layout, mapas, detalle de paquete, controles comunes
  pages/            una página por sección
```
