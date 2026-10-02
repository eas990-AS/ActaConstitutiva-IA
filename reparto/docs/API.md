# Contrato de la API — Reparto

Base: `/api`. JSON salvo donde se indica `multipart/form-data`.
Autenticación: `Authorization: Bearer <accessToken>` en todo excepto `POST /api/auth/login`.
Fechas: ISO 8601 en UTC (`2026-10-02T15:04:05.000Z`). Días de operación: `YYYY-MM-DD` en la zona
horaria del servidor (`TZ`, por defecto `America/Mexico_City`).
Coordenadas siempre como objeto `{ "lat": number, "lng": number }`.

Errores: `{ "statusCode": number, "message": string | string[], "code"?: string }`.

## Tipos

```ts
type Role = 'ADMIN' | 'SUPERVISOR' | 'COURIER';

type PackageStatus =
  | 'REGISTERED'  // sin repartidor
  | 'ASSIGNED'    // tiene repartidor, recorrido no iniciado
  | 'IN_ROUTE'    // el repartidor inició su recorrido
  | 'DELIVERED'
  | 'FAILED'      // intento fallido; espera reprogramar o devolver
  | 'RETURNED';   // devuelto al remitente (final)

type FailReason = 'NO_ONE_HOME' | 'WRONG_ADDRESS' | 'REJECTED' | 'UNSAFE_AREA' | 'OTHER';

type EvidenceKind = 'PACKAGE_PHOTO' | 'FACADE_PHOTO' | 'SIGNATURE';

type AlertType = 'OUT_OF_ZONE' | 'LOW_BATTERY' | 'NO_SIGNAL' | 'PANIC';

interface LatLng { lat: number; lng: number }

interface User {
  id: string; name: string; username: string; role: Role;
  phone: string | null; zoneId: string | null; active: boolean;
}

interface Zone {
  id: string; name: string; color: string;   // '#RRGGBB'
  polygon: LatLng[];                         // >= 3 vértices, sin repetir el primero
  active: boolean;
}

interface Package {
  id: string; trackingCode: string;
  recipientName: string; recipientPhone: string | null;
  address: string; location: LatLng | null; notes: string | null;
  scheduledDate: string;                     // 'YYYY-MM-DD'
  status: PackageStatus; attempts: number;
  zoneId: string | null; courierId: string | null;
  createdAt: string; updatedAt: string;
}

interface Evidence {
  id: string; kind: EvidenceKind;
  url: string;          // URL firmada temporal, usable directo en <img src>
  sha256: string; createdAt: string;
}

interface DeliveryAttempt {
  id: string; packageId: string; routeId: string | null; courierId: string;
  result: 'DELIVERED' | 'FAILED';
  failReason: FailReason | null;
  recipientName: string | null; comment: string | null;
  distanceJustification: string | null;
  location: LatLng | null;
  distanceMeters: number | null;   // distancia al destino del paquete
  occurredAt: string;
  evidences: Evidence[];
}

interface Route {          // "Recorrido"
  id: string; courierId: string; date: string;
  startedAt: string; startLocation: LatLng | null;
  endedAt: string | null; endLocation: LatLng | null;
  distanceKm: number;      // calculado con los puntos GPS
}

interface LocationPoint {
  lat: number; lng: number; accuracy?: number; speed?: number;  // m/s
  battery?: number;        // 0..1
  recordedAt: string;
}

interface Alert {
  id: string; type: AlertType; courierId: string; courierName: string;
  message: string; location: LatLng | null;
  createdAt: string; acknowledgedAt: string | null;
}
```

## Autenticación

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{ username, password }` | `{ accessToken, user: User }` |
| GET | `/auth/me` | — | `User` |

## Zonas (ADMIN escribe; ADMIN y SUPERVISOR leen)

| Método | Ruta | Cuerpo / query | Respuesta |
| --- | --- | --- | --- |
| GET | `/zones` | — | `Zone[]` (solo activas) |
| POST | `/zones` | `{ name, color?, polygon }` | `Zone` |
| PATCH | `/zones/:id` | `{ name?, color?, polygon? }` | `Zone` |
| DELETE | `/zones/:id` | — | `204` (baja lógica) |

## Usuarios (solo ADMIN)

| Método | Ruta | Cuerpo / query | Respuesta |
| --- | --- | --- | --- |
| GET | `/users` | `?role=&zoneId=` | `User[]` |
| POST | `/users` | `{ name, username, password, role, phone?, zoneId? }` | `User` |
| PATCH | `/users/:id` | `{ name?, password?, phone?, zoneId?, active? }` | `User` |

SUPERVISOR puede hacer `GET /users?role=COURIER`.

## Paquetes (ADMIN y SUPERVISOR)

| Método | Ruta | Cuerpo / query | Respuesta |
| --- | --- | --- | --- |
| GET | `/packages` | `?date=YYYY-MM-DD&zoneId=&courierId=&status=&q=` | `Package[]` |
| POST | `/packages` | `{ trackingCode, recipientName, recipientPhone?, address, location?, notes?, scheduledDate }` | `Package` |
| POST | `/packages/import` | multipart, campo `file` (CSV) | `{ created: number, errors: { line: number, message: string }[] }` |
| GET | `/packages/:id` | — | `Package & { history: DeliveryAttempt[] }` |
| POST | `/packages/:id/assign` | `{ courierId }` | `Package` |
| POST | `/packages/:id/reschedule` | `{ scheduledDate, courierId? }` | `Package` (vuelve a `ASSIGNED`) |
| POST | `/packages/:id/return` | — | `Package` (`RETURNED`) |

Al crear o importar, si el paquete trae `location` se busca la zona cuyo polígono la contiene
y se asigna al repartidor activo de esa zona con menos paquetes ese día.

CSV de importación (encabezado obligatorio, separador `,`, UTF-8):
`trackingCode,recipientName,recipientPhone,address,lat,lng,notes,scheduledDate`

## App del repartidor (solo COURIER)

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| GET | `/courier/today` | — | `{ route: Route \| null, zone: Zone \| null, packages: Package[] }` |
| POST | `/courier/routes/start` | `{ location: LatLng, startedAt? }` | `Route` |
| POST | `/courier/routes/:id/end` | `{ location: LatLng, endedAt? }` | `Route & { summary: { delivered, failed, pending } }` |
| POST | `/courier/locations` | `{ points: LocationPoint[] }` (máx. 500) | `{ accepted: number }` |
| POST | `/courier/packages/:id/deliver` | multipart (ver abajo) | `DeliveryAttempt` |
| POST | `/courier/packages/:id/fail` | multipart (ver abajo) | `DeliveryAttempt` |
| POST | `/courier/panic` | `{ location: LatLng }` | `Alert` |

`packages` de `/courier/today` = paquetes del repartidor programados para hoy (cualquier estado),
ordenados por cercanía en cadena (vecino más cercano) desde el inicio del recorrido o, si no hay
recorrido, en orden de creación.

Solo puede haber un recorrido abierto por repartidor. Iniciar recorrido cambia sus paquetes de
hoy de `ASSIGNED` a `IN_ROUTE`. `POST /courier/locations` sin recorrido abierto responde `409`.

**Entrega** — `POST /courier/packages/:id/deliver`, `multipart/form-data`:

- `clientId` (uuid generado en el teléfono; idempotencia: reenviar el mismo devuelve el mismo intento)
- `lat`, `lng`, `occurredAt` (ISO; hora en que se tomó la evidencia)
- `recipientName?`, `comment?`, `distanceJustification?`
- archivos `photos` (1 a 3, image/jpeg o image/png, máx. 8 MB c/u), `signature?` (1, image/png)

Si la distancia al destino es mayor a 150 m y no hay `distanceJustification` → `422` con
`code: "DISTANCE_JUSTIFICATION_REQUIRED"`.

**Entrega fallida** — `POST /courier/packages/:id/fail`, `multipart/form-data`:

- `clientId`, `lat`, `lng`, `occurredAt`, `reason: FailReason`, `comment?` (obligatorio si `OTHER`)
- archivo `photos` (1, foto de fachada)

## Rastreo (ADMIN y SUPERVISOR)

| Método | Ruta | Query | Respuesta |
| --- | --- | --- | --- |
| GET | `/tracking/live` | `?zoneId=` | `LiveCourier[]` |
| GET | `/tracking/routes` | `?date=&courierId=` | `Route[]` |
| GET | `/tracking/routes/:id/path` | — | `{ route: Route, points: LocationPoint[], attempts: DeliveryAttempt[] }` |

```ts
interface LiveCourier {
  courier: { id: string; name: string; zoneId: string | null };
  route: Route | null;              // recorrido de hoy
  last: LocationPoint | null;
  state: 'MOVING' | 'STOPPED' | 'NO_SIGNAL' | 'OFF';
  progress: { total: number; delivered: number; failed: number; pending: number };
}
```

`state`: `OFF` sin recorrido abierto; `NO_SIGNAL` último punto hace más de 10 min;
`MOVING` velocidad > 1 m/s o se movió > 50 m en los últimos 2 min; si no, `STOPPED`.

### Tiempo real (Socket.IO)

Conexión: `io(BASE_URL + '/live', { auth: { token } })` (solo ADMIN y SUPERVISOR).
Eventos emitidos por el servidor:

- `location` → `{ courierId, point: LocationPoint }`
- `route` → `{ courierId, route: Route, event: 'start' | 'end' }`
- `attempt` → `{ courierId, attempt: DeliveryAttempt, package: Package }`
- `alert` → `Alert`

## Alertas (ADMIN y SUPERVISOR)

| Método | Ruta | Query | Respuesta |
| --- | --- | --- | --- |
| GET | `/alerts` | `?date=&pending=true` | `Alert[]` |
| POST | `/alerts/:id/ack` | — | `Alert` |

Se generan al recibir ubicaciones (`OUT_OF_ZONE`, `LOW_BATTERY` < 15 %), con el botón de
emergencia (`PANIC`) y por revisión periódica cada minuto (`NO_SIGNAL` > 10 min con recorrido
abierto). No se repite una alerta del mismo tipo y repartidor mientras siga sin atender.

## Reportes (ADMIN y SUPERVISOR)

| Método | Ruta | Query | Respuesta |
| --- | --- | --- | --- |
| GET | `/reports/daily` | `?date=&zoneId=` | `DailyReport` |
| GET | `/reports/daily.csv` | `?date=&zoneId=` | `text/csv` con un renglón por paquete |

```ts
interface Totals { total: number; delivered: number; failed: number; pending: number;
                   returned: number; effectiveness: number /* delivered / total, 0..1 */ }
interface DailyReport {
  date: string;
  totals: Totals;
  byZone: ({ zoneId: string | null; zoneName: string } & Totals)[];
  byCourier: ({ courierId: string; courierName: string; distanceKm: number } & Totals)[];
  failureReasons: { reason: FailReason; count: number }[];
}
```

## Evidencias

`GET /evidences/:id/file?exp=<epoch s>&sig=<hmac>` — no requiere encabezado de autenticación;
la firma caduca en 15 minutos. Las URL vienen ya firmadas en `Evidence.url`.
