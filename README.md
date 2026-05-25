# arellan-mechanic-ui

Interfaz táctil para mecánicos y practicante de la Clínica Automotriz Arellan Hnos. Diseñada para tablets instaladas en la zona de trabajo del taller en Surquillo. Soporta modo offline parcial.

## Descripción

`arellan-mechanic-ui` reemplaza el papel en el taller. Los mecánicos registran el ingreso del vehículo, documentan el avance de la reparación, solicitan repuestos y obtienen la firma del cliente al recoger, todo desde la tablet sin necesidad de papel ni memoria personal.

## Audiencia

| Rol | Usuario | Acceso |
|-----|---------|--------|
| `mechanic` | Mecánicos del taller | Sus propias OTs, checklist, solicitud de repuestos, fotos |
| `trainee` | Practicante | Como mechanic + aprobación requerida para cerrar OTs y solicitar repuestos de alto valor |

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | React 18 + TypeScript + Vite |
| PWA / Offline | Vite PWA Plugin + Workbox (service worker) |
| Estilos | Tailwind CSS + `@arellan/ui` (botones grandes, touch-friendly) |
| Estado | Zustand |
| Offline sync | Cola local IndexedDB → sync al reconectar |
| Fotos | MediaDevices API (cámara de tablet) |
| Firma digital | Canvas API + firma en pantalla táctil |
| Testing | Vitest + React Testing Library |

## Diseño UX

- **Botones grandes** — mínimo 56px de altura, fáciles con manos con guantes
- **Sin flujos complejos** — máximo 3 toques para cualquier acción crítica
- **Sin acceso a datos sensibles** — mecánicos ven matrícula y modelo del vehículo, NO el nombre ni teléfono del propietario
- **Sesión con PIN de 6 dígitos** — no contraseña compleja
- **Timeout automático** — 30 minutos de inactividad cierra sesión
- **Tablet fija** — la tablet está en soporte físico en el taller, no es un dispositivo personal

## Estructura de Carpetas

```
src/
├── pages/
│   ├── login/                  # Login con PIN de rol mechanic/trainee
│   ├── my-orders/              # OTs asignadas al mecánico activo
│   ├── vehicle-intake/         # Checklist de ingreso del vehículo
│   ├── work-progress/          # Registro de avance por etapas
│   ├── parts-request/          # Solicitud de repuestos vinculada a OT
│   └── photo-upload/           # Evidencias fotográficas obligatorias
├── components/
│   └── touch-friendly/         # Componentes optimizados para pantalla táctil
├── features/
│   ├── checkin/                # OCR de placa, km, combustible, fotos
│   ├── diagnostico/            # Registro de diagnóstico técnico
│   ├── avance/                 # Etapas: diagnóstico → trabajo → revisión → entrega
│   ├── repuestos/              # Solicitud con vinculación obligatoria a OT
│   └── entrega/                # Firma digital del cliente
├── offline/                    # Queue local + sync automático
└── device/                     # Acceso a cámara, GPS, pantalla
```

## Flujo del Mecánico en el Taller

```
1. Login con PIN de 6 dígitos
2. Ver OTs asignadas → seleccionar vehículo
3. Checklist de ingreso:
   - Captura de placa (OCR o manual)
   - Registro de kilometraje y combustible
   - 4 fotos obligatorias (frontal, posterior, laterales) + tablero
4. Diagnóstico técnico + descripción del problema
5. Avance por etapas con timestamps automáticos
6. Solicitar repuestos → seleccionar OT → descripción + cantidad
   (queda en PENDING hasta aprobación de admin/owner)
7. Registrar trabajo realizado
8. Fotos del vehículo terminado
9. Firma digital del cliente en pantalla táctil
10. Cierre de OT → notificación automática al cliente
```

## Modo Offline

Cuando no hay conexión a internet en el taller:
- Las acciones se encolan localmente en IndexedDB
- El mecánico puede seguir trabajando sin interrupción
- Al restaurarse la conexión, el queue se sincroniza automáticamente con el backend
- Conflictos se resuelven a favor del timestamp del dispositivo

## Funcionalidades MVP

- Login con PIN por rol mecánico
- Checklist de ingreso de vehículo con fotos y OCR de placa
- Registro de avance de OT por etapas
- Solicitud de repuestos vinculada obligatoriamente a OT activa
- Evidencias fotográficas inmutables (hash SHA-256 en BD)
- Firma digital del cliente al recoger

## Funcionalidades Fase 2

- Timer por OT (cronometrado automático por etapa)
- Chat con administrativos sin salir de la app
- Historial propio: OTs trabajadas, calificación de clientes

## Variables de Entorno

```env
VITE_API_URL=https://api.arellan.pe
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_APP_URL=https://taller.arellan.pe
```

## Scripts de Desarrollo

```bash
npm install
npm run dev          # localhost:3002
npm run build
npm run preview
npm run test
```

## Dominio

`taller.arellan.pe` — Acceso restringido a roles `mechanic` y `trainee`. Solo desde el dispositivo autorizado.

## Repos Relacionados

- `arellan-platform` — API de OTs, inventario, auditoría
- `arellan-hardware-iot` — Integración con ZKTeco (control de asistencia en taller)

## Licencia

Privado — © 2026 Arellan Hnos. Todos los derechos reservados.
