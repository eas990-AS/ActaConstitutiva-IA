# Reparto — App del repartidor

App móvil (Expo + React Native + TypeScript) para los repartidores del sistema de rastreo de paquetes.
Consume la API descrita en [`../docs/API.md`](../docs/API.md) (sección *App del repartidor*).

- Expo SDK 57, Expo Router (rutas en `src/app/`), TypeScript estricto.
- Toda la interfaz está en español (México).

## Funciones

| Pantalla | Qué hace |
| --- | --- |
| Aviso de privacidad | Se muestra la primera vez; hay que aceptarlo para continuar. |
| Iniciar sesión | Usuario y contraseña. El token se guarda en `expo-secure-store`. Solo entran usuarios `COURIER`. |
| Inicio | `GET /courier/today`: zona, totales (total / entregados / fallidos / pendientes) y botón **Iniciar recorrido**. |
| Mis paquetes | Lista en el orden que regresa el servidor, con estado y "Pendiente de sincronizar". |
| Detalle | Llamar, WhatsApp, **Navegar** (Google Maps o Waze), notas y acciones **Entregado** / **No entregado**. |
| Confirmar entrega | 1 a 3 fotos (solo cámara), nombre de quien recibe, firma opcional, comentario. GPS + hora al tomar la evidencia. Si está a más de 150 m del destino pide justificación. |
| Entrega fallida | Motivo, 1 foto de fachada, comentario (obligatorio si es "Otro motivo"). |
| Fin de recorrido | Resumen, confirmación, cierre del recorrido y fin del rastreo. |
| Sincronización | Lo que falta por enviar y los registros rechazados (corregir justificación, reintentar o descartar). |
| Botón **SOS** | En el encabezado mientras hay recorrido abierto; pide confirmación y envía `POST /courier/panic`. |

### Rastreo en segundo plano

- Tarea `reparto-background-location` (`src/location/task.ts`) con `Location.startLocationUpdatesAsync`:
  precisión alta, cada ~25 m / ~15 s, notificación fija en Android **"Recorrido activo"**.
- Cada punto lleva el nivel de batería. Se guardan en una cola persistente y se mandan en lotes de hasta
  500 a `POST /courier/locations` (la propia tarea intenta enviar como máximo una vez por minuto).
- Solo corre entre **Iniciar recorrido** y **Terminar recorrido**. Si el teléfono se reinicia o la app se
  cierra con el recorrido abierto, al abrirla se reanuda.
- Si el rastreo en segundo plano no está disponible (por ejemplo en Expo Go), se usa un respaldo en primer
  plano y la franja superior lo indica ("ubicación solo con la app abierta").

### Modo sin conexión

- Entregas, intentos fallidos y cierre de recorrido se guardan en una bandeja de salida (`AsyncStorage`);
  las fotos y la firma se copian al directorio de documentos de la app para que no se pierdan.
- El paquete se marca al instante como entregado / no entregado con la etiqueta "Pendiente de sincronizar".
- Se sincroniza al recuperar conexión, al volver la app al frente, cada 30 s y con "Sincronizar ahora",
  con espera creciente entre reintentos (5 s … 10 min). Cada envío lleva su `clientId`, así que reenviar es seguro.
- Errores 4xx (p. ej. `422 DISTANCE_JUSTIFICATION_REQUIRED`) no se reintentan solos: se avisa al usuario y
  aparecen en la pestaña **Sincronizar** para corregirlos o descartarlos.

## Configurar la URL de la API

La app usa, en este orden:

1. Variable de entorno `EXPO_PUBLIC_API_URL` (se incrusta al iniciar Metro / al compilar).
2. `expo.extra.apiUrl` en `app.json`.

Se acepta con o sin `/api` al final (`http://192.168.1.50:3000` o `http://192.168.1.50:3000/api`).

> En el teléfono **no** uses `localhost`: pon la IP de tu computadora en la red Wi-Fi
> (por ejemplo `ipconfig getifaddr en0` en macOS o `hostname -I` en Linux). El backend corre en el puerto 3000.

```bash
# opción 1: archivo .env.local (no se sube a git)
echo "EXPO_PUBLIC_API_URL=http://192.168.1.50:3000/api" > .env.local

# opción 2: en la línea de comandos
EXPO_PUBLIC_API_URL=http://192.168.1.50:3000/api npx expo start
```

La URL en uso se muestra abajo en la pantalla de inicio de sesión.

Para pruebas con `http://` (sin TLS) en Android, las builds de desarrollo permiten tráfico sin cifrar.
En producción usa `https://`.

## Ejecutar

```bash
cd reparto/mobile
npm install
npx tsc --noEmit        # verificación de tipos
```

### Opción A — Expo Go (prueba rápida, sin rastreo en segundo plano)

1. Instala **Expo Go** en el teléfono (debe corresponder al SDK 57).
2. `npm run start:go` (equivale a `npx expo start --go`) y escanea el código QR.

En Expo Go funcionan inicio de sesión, paquetes, cámara, firma y modo sin conexión, pero **la ubicación en
segundo plano no**: Expo Go no permite tareas de ubicación en segundo plano. La app lo detecta y registra la
ubicación solo mientras está abierta.

### Opción B — Build de desarrollo (necesaria para el rastreo en segundo plano)

Requiere Android Studio (Android) o Xcode en macOS (iOS), o usar EAS en la nube.

```bash
# Local, con el teléfono conectado por USB (depuración USB activada)
npx expo run:android
npx expo run:ios --device

# Después, para siguientes sesiones:
npx expo start           # abre la build de desarrollo instalada
```

Con EAS (sin herramientas nativas locales):

```bash
npx eas-cli@latest build --profile development --platform android
```

Instala el APK resultante y ejecuta `npx expo start`.

### Permisos que pide la app

- Ubicación "mientras se usa" y luego "**Permitir todo el tiempo**" (Android: Ajustes > Ubicación > Permitir todo el tiempo).
- Cámara.
- Android 13+: notificaciones (para ver la notificación "Recorrido activo").
- Recomendado: quitar la optimización de batería para la app, para que el sistema no la detenga durante el recorrido.

## Estructura

```
index.ts                 # entrada: registra la tarea de ubicación y arranca Expo Router
app.json                 # permisos, textos de permisos (iOS) y extra.apiUrl
src/
  app/                   # pantallas (Expo Router)
    _layout.tsx          # aviso de privacidad → login → app
    privacy.tsx, login.tsx
    (app)/_layout.tsx    # proveedor de estado del repartidor + pila
    (app)/(tabs)/        # Inicio, Paquetes, Sincronizar
    (app)/package/[id].tsx, deliver/[id].tsx, fail/[id].tsx, end-route.tsx
  api/                   # cliente tipado y tipos copiados del contrato
  auth/                  # token (SecureStore), sesión y contexto de autenticación
  location/              # tarea en segundo plano, inicio/fin de rastreo, GPS actual, batería
  sync/                  # bandeja de salida, cola de ubicaciones, envío y reintentos
  state/                 # estado del día (paquetes, recorrido, pendientes)
  components/            # botones, cámara, firma, franja de estado, SOS…
  labels.ts              # textos y etiquetas en español
```
