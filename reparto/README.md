# Reparto — rastreo de repartidores y entregas

Plataforma de tres piezas que comparten la API descrita en [`docs/API.md`](docs/API.md):

| Carpeta | Qué es | Tecnología |
| --- | --- | --- |
| [`backend/`](backend/README.md) | API, base de datos, tiempo real, alertas y reportes | NestJS, Prisma, PostgreSQL, Socket.IO |
| [`admin/`](admin/README.md) | Panel web: mapa en vivo, entregas por día, no entregados, paquetes, zonas, reportes | Vite, React, Leaflet |
| [`mobile/`](mobile/README.md) | App del repartidor: recorrido, GPS en segundo plano, fotos, firma, modo sin conexión | Expo (React Native) |

## Probarlo en 5 minutos

```bash
cd reparto && docker compose up -d                 # PostgreSQL
cd backend && cp .env.example .env && npm install
npx prisma migrate deploy && npm run seed && npm run dev   # API en :3000
# en otra terminal
cd reparto/admin && npm install && npm run dev      # panel en http://localhost:5173 (admin / admin123)
# en otra terminal: un repartidor simulado recorre su zona y entrega paquetes
cd reparto/backend && npm run simulate
```

Para la app del repartidor en un teléfono, ver [`mobile/README.md`](mobile/README.md)
(usuario de ejemplo `juan / reparto123`).
