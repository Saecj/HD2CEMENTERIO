# Informe de testeo — Módulos Cliente (Frontend)

Fecha: 2026-04-11  
Proyecto: Cementerio digital (QRKATA)  
Ámbito: Panel **Cliente** (tabs: Inicio, Búsqueda, Mapa, Estado, Mis reservas, Pagos, Perfil)

## 1) Entorno de prueba
- Frontend: `frontend/` (Vite + React)
- Backend: `backend/` (Node/Express)
- Base de datos: Postgres (según configuración local)
- Navegador: __________________

## 2) Precondiciones
- Backend levantado y accesible (por defecto `http://localhost:3001`).
- Frontend levantado (por defecto `http://localhost:5173`).
- BD con migraciones aplicadas.
- Usuario cliente de prueba:
  - Email: __________________
  - Password: _______________

## 3) Evidencias
Adjuntar capturas para cada módulo:
- E1: Inicio — lista tumbas disponibles
- E2: Inicio — modal “Reservar una parcela”
- E3: Inicio — **resumen/ticket** post-reserva (arriba)
- E4: Búsqueda — resultados
- E5: Mapa — selección de celda
- E6: Estado — estado de tumba/difunto
- E7: Mis reservas — lista + estado (pending/confirmed)
- E8: Pagos — lista + flujo de pago
- E9: Perfil — edición de usuario/username

## 4) Criterio de aceptación (global)
- Los módulos **cargan sin errores** en consola.
- Los botones/enlaces muestran **cursor pointer**.
- Acciones protegidas requieren login (reserva/pagos), pero lectura pública funciona donde aplica.

---

## 5) Casos de prueba por módulo

### A) Inicio (Reservas) — `Inicio`

**A1 — Visualización pública de tumbas disponibles (sin sesión)**
- Pasos:
  1. Cerrar sesión.
  2. Entrar a tab `Inicio`.
- Esperado:
  - Se muestra “Tumbas disponibles” con tarjetas.
  - No debe forzar login para ver la lista.
- Resultado: ☐ OK ☐ Falla
- Evidencia: E1

**A2 — Abrir mapa de reservas**
- Pasos:
  1. En `Inicio`, click en “Abrir mapa” o “Ver en mapa”.
- Esperado:
  - Abre modal “Reservar una parcela”.
  - Se ven pasos (1 Datos / 2 Parcela) y el mapa.
- Resultado: ☐ OK ☐ Falla
- Evidencia: E2

**A3 — Reservar requiere login**
- Pasos:
  1. Sin sesión, abrir modal.
  2. Intentar confirmar reserva.
- Esperado:
  - Muestra mensaje “Inicia sesión para reservar”.
  - Abre panel de login.
- Resultado: ☐ OK ☐ Falla
- Evidencia: _______

**A4 — Reserva exitosa muestra resumen (ticket) y sube al inicio**
- Pasos:
  1. Iniciar sesión como cliente.
  2. Abrir modal, completar datos (difunto, fechas opcionales) y seleccionar parcela disponible.
  3. Confirmar.
- Esperado:
  - Muestra mensaje de “Reserva creada (RSV-…) — pendiente de aprobación”.
  - Muestra tarjeta “Tu reserva (RSV-…)” con: estado, difunto, desde/hasta, tumba, sección, fila/col.
  - La pantalla hace scroll hacia arriba para que el resumen sea visible.
  - Se mantiene botón “Ir a Mis reservas”.
- Resultado: ☐ OK ☐ Falla
- Evidencia: E3

**A5 — Cursor en botones/enlaces**
- Pasos:
  1. Pasar el mouse por botones (Abrir mapa / Ver en mapa / Reservar desde mapa).
- Esperado:
  - Cursor cambia a mano.
- Resultado: ☐ OK ☐ Falla
- Evidencia: _______

---

### B) Búsqueda — `Búsqueda`

**B1 — Buscar por nombre / código / texto**
- Pasos:
  1. Ir a tab `Búsqueda`.
  2. Buscar por nombre de difunto (si hay datos).
  3. Buscar por patrón `RSV-...`.
- Esperado:
  - Se muestran resultados relacionados.
  - Sin errores en consola.
- Resultado: ☐ OK ☐ Falla
- Evidencia: E4

---

### C) Mapa — `Mapa`

**C1 — Render y estados (available/pending/confirmed/occupied/maintenance)**
- Pasos:
  1. Ir a tab `Mapa`.
  2. Cambiar sector si aplica.
- Esperado:
  - Se renderiza grilla.
  - Las celdas reflejan estado (colores/leyenda si existe).
- Resultado: ☐ OK ☐ Falla
- Evidencia: E5

---

### D) Estado — `Estado`

**D1 — Visualizar estado de la selección**
- Pasos:
  1. Seleccionar una tumba/difunto desde Búsqueda o Mapa.
  2. Ir a tab `Estado`.
- Esperado:
  - Muestra estado coherente (reservada/ocupada/pago, etc. según datos).
- Resultado: ☐ OK ☐ Falla
- Evidencia: E6

---

### E) Mis reservas — `Mis reservas`

**E1 — Listado de reservas del cliente**
- Pasos:
  1. Iniciar sesión.
  2. Ir a tab `Mis reservas`.
- Esperado:
  - Lista reservas del usuario.
  - Muestra estado (pending/confirmed) y datos de tumba.
- Resultado: ☐ OK ☐ Falla
- Evidencia: E7

**E2 — Flujo “Ir a Mis reservas” desde el resumen**
- Pasos:
  1. Crear una reserva.
  2. Click en botón “Ir a Mis reservas” del resumen.
- Esperado:
  - Navega a tab `Mis reservas`.
- Resultado: ☐ OK ☐ Falla
- Evidencia: _______

---

### F) Pagos — `Pagos`

**F1 — Listado de pagos**
- Pasos:
  1. Ir a tab `Pagos`.
- Esperado:
  - Lista pagos asociados a reservas del cliente.
- Resultado: ☐ OK ☐ Falla
- Evidencia: E8

**F2 — Pagar una reserva (si aplica en tu demo)**
- Pasos:
  1. Si existe una reserva `confirmed`, intentar pagar.
- Esperado:
  - Inicia flujo de pago según implementación.
  - La UI refleja estado del pago.
- Resultado: ☐ OK ☐ Falla
- Evidencia: _______

---

### G) Perfil — `Perfil`

**G1 — Ver datos del usuario**
- Pasos:
  1. Ir a tab `Perfil`.
- Esperado:
  - Muestra email/username y demás datos.
- Resultado: ☐ OK ☐ Falla
- Evidencia: E9

**G2 — Editar username y reflejar en Navbar**
- Pasos:
  1. Cambiar `username`.
  2. Guardar.
- Esperado:
  - Se actualiza `Hola, <username>` en la barra.
- Resultado: ☐ OK ☐ Falla
- Evidencia: _______

---

## 6) Smoke checks técnicos (rápidos)

**S1 — Build del frontend**
- Comando (en `frontend/`): `npm run build`
- Esperado: build exitoso.
- Resultado: ☐ OK ☐ Falla

**S2 — Endpoints mínimos (si tienes backend+BD listos)**
- `GET /api/auth/me`
- `GET /api/client/available-graves`
- `GET /api/client/grave-map`
- `GET /api/client/reservations` (requiere sesión)
- `GET /api/client/payments` (requiere sesión)
- Resultado: ☐ OK ☐ Falla

## 7) Observaciones / incidencias
- [ ] Incidencia 1: ______________________________________________
- [ ] Incidencia 2: ______________________________________________

## 8) Conclusión
- Estado general del Panel Cliente: ☐ Aprobado ☐ Aprobado con observaciones ☐ No aprobado
