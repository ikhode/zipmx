# Guía Técnica Modular: Ecosistema ZIPP (Cloudflare Fullstack)

Esta documentación detalla la implementación técnica del flujo de movilidad ZIPP, estructurada en los módulos solicitados (2 al 7). La arquitectura se basa en el stack **Cloudflare Fullstack (Pages, Workers, D1, Durable Objects)**.

---

## 🏗️ Arquitectura de Referencia
- **Infraestructura**: Cloudflare Edge (Always On).
- **Controlador de Viajes**: Hono (Backend) + D1 (SQL) + WebSockets (Real-time).
- **Diseño**: Minimalista Premium (Glassmorphism V2).

---

## 📦 Módulo 2: Solicitud de Viaje (UX Pasajero)
**Archivos Clave**: `src/components/RideRequestSheet.tsx`, `src/lib/geocoding.ts`

- **Funcionalidad**: Selección de origen/destino con autocompletado via Mapbox/Osm. Cálculo de tarifa dinámica basado en `VEHICLE_RATES` (base + dist + tiempo).
- **Lógica de Negocio**: 
  - Validación de sesión (anon_ upgrade required).
  - Cálculo de distancia Haversine para estimaciones rápidas.
  - Generación de solicitud en tabla `rides` con estado `requested`.

---

## 📦 Módulo 3: Recepción de Solicitud (UX Conductor)
**Archivos Clave**: `src/components/DriverModeSheet.tsx`, `functions/api/[[route]].ts`

- **Funcionalidad**: El conductor recibe solicitudes filtradas por cercanía y disponibilidad.
- **Lógica de Negocio**:
  - Endpoint `GET /api/rides/available` consulta viajes sin conductor asignado.
  - Al aceptar, se actualiza el `driverId` en el registro del viaje y se emite notificación real-time al pasajero.

---

## 📦 Módulo 4: Localización y Viaje (GPS)
**Archivos Clave**: `src/components/MapView.tsx`, `src/components/DriverModeSheet.tsx`

- **Funcionalidad**: Visualización de marcadores dinámicos. Botón de **Navegación** que lanza Google Maps externo.
- **Lógica de Negocio**:
  - El conductor actualiza su posición via `POST /api/driver/location`.
  - Estados del viaje: `accepted` (conductor en camino) -> `arrived` (en el punto) -> `in_progress` (pasajero a bordo).

---

## 📦 Módulo 5 & 7: Finalización y Calificaciones
**Archivos Clave**: `src/components/PostRideSummary.tsx`, `functions/api/[[route]].ts`

- **Funcionalidad**: Resumen post-viaje con estadísticas finales. Sistema de calificación mutua (1-5 estrellas).
- **Lógica de Calificación**:
  - Endpoint `POST /api/rides/:id/rate` guarda el feedback.
  - Se recalcula el promedio de estrellas (`rating`) del conductor en tiempo real en la tabla `drivers`.

---

## 📦 Módulo 6: Pagos y Wallet
**Archivos Clave**: `src/components/AccountMenuSheet.tsx`, `functions/api/[[route]].ts`

- **Funcionalidad**: Billetera premium con historial de transacciones.
- **Lógica Financiera**:
  - `totalEarnings`: Ganancia bruta del conductor (sumatoria de `totalFare`).
  - `unpaidCommissionAmount`: 10% de comisión calculado automáticamente.
  - Simulación de transacciones recientes basada en el balance del usuario.

---

## 🚀 Despliegue y Mantenimiento
- **Comando de Despliegue**: `npm run deploy`
- **Base de Datos**: `wrangler d1 migrations apply zipp_database --remote`
- **Monitorización**: Cloudflare Workers Analytics para trazas de API y latencia.

---
**ZIPP Mobility System - Senior Implementation v1.0.0**
