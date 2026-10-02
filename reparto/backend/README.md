# Backend — API de reparto

NestJS 11 + Prisma 6 + PostgreSQL + Socket.IO. El contrato completo está en
[`../docs/API.md`](../docs/API.md).

## Arranque local

```bash
cd reparto
docker compose up -d          # PostgreSQL en localhost:5432 (o usa uno propio)
cd backend
cp .env.example .env          # ajusta secretos
npm install
npx prisma migrate deploy     # crea las tablas
npm run seed                  # datos de ejemplo (opcional)
npm run dev                   # http://localhost:3000/api
```

Usuarios del ejemplo: `admin / admin123`, `supervisor / super123`,
repartidores `juan / reparto123` (zona Centro) y `maria / reparto123` (zona Roma-Condesa).

## Pruebas

Requieren una base de datos cuyo nombre termine en `_test` (se vacía en cada corrida):

```bash
createdb -O reparto reparto_test     # una sola vez
npm test                             # o TEST_DATABASE_URL=... npm test
```

## Qué hace

| Módulo | Rutas | Notas |
| --- | --- | --- |
| auth | `/auth/login`, `/auth/me` | JWT de 12 h; usuarios inactivos quedan fuera al instante |
| users, zones | `/users`, `/zones` | Zonas como polígonos `{lat,lng}[]` |
| packages | `/packages`, `/packages/import` | Asignación automática por zona y carga de trabajo; importación CSV |
| courier | `/courier/*` | Recorrido, GPS por lotes, entregas con fotos (idempotentes por `clientId`) |
| tracking | `/tracking/*` + Socket.IO `/live` | Mapa en vivo y trayectos históricos |
| alerts | `/alerts` | Fuera de zona, batería baja, sin señal (cada minuto), pánico |
| reports | `/reports/daily`, `/reports/daily.csv` | Totales por zona, repartidor y motivo de falla |
| evidences | `/evidences/:id/file` | Fotos con URL firmada de 15 min y hash SHA-256 |

Los supervisores con zona asignada solo ven su zona; sin zona, ven todas.

## Producción

- Define `JWT_SECRET` y `EVIDENCE_SECRET` largos y distintos.
- Las fotos se guardan en `STORAGE_DIR`; para varios servidores reemplaza
  `src/common/storage.service.ts` por S3/GCS (misma interfaz).
- `npm run build && npm start` detrás de HTTPS (Nginx, Caddy o el balanceador de la nube).
