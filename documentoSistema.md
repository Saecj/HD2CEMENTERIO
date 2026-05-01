# Cementerio (monorepo)

## Requisitos
- Node.js (recomendado LTS)

## Instalar dependencias
Desde la raíz:

```bash
npm run install:all
```

## Base de datos (Postgres)
1) Crea `backend/.env` desde `backend/.env.example` y completa credenciales.
2) Ejecuta migraciones:

```bash
npm --prefix backend run db:migrate
```

Opcional (recomendado para empezar):
- (Legacy) Antes se usaba OTP; ahora el flujo principal es por contraseña.

## Desarrollo (frontend + backend)
Desde la raíz:

```bash
npm run dev
```

Si estás dentro de una carpeta específica:

- Dentro de `backend/`:

```bash
npm run dev
```

```bash
npm run start
```

- Dentro de `frontend/`:

```bash
npm run dev
```

Nota: si ejecutas `npm --prefix backend ...` mientras tu terminal ya está en `backend/`, npm intentará buscar `backend/backend/package.json` y fallará con `ENOENT`.

- Backend: `http://localhost:3001`
  - Health: `http://localhost:3001/health`
  - Health (proxy): `http://localhost:3001/api/health`
  - Health BD: `http://localhost:3001/api/health/db`
- Frontend: `http://localhost:5173`

## Login por correo + contraseña

Requiere aplicar las migraciones:
- `backend/sql/005_password_auth.sql`
- `backend/sql/006_email_verification.sql`

- `POST /api/auth/register` `{ email, documentId, phone?, password, confirmPassword, acceptTerms }` → crea un registro pendiente y envía código.
- `POST /api/auth/verify-email` `{ email, code }` → crea la cuenta (verificada) y abre sesión.
- `POST /api/auth/login` `{ email, password }` → crea sesión (cookie `sid`).
- `GET /api/auth/me` → devuelve el usuario en sesión.

## Búsqueda (MVP)
- `GET /api/search?q=...` (requiere sesión) → lista difuntos y su tumba/ubicación/estado.

## Carga de datos (MVP, solo API)
- Admin:
  - `POST /api/admin/sectors` `{ name }`
  - `POST /api/admin/graves` `{ code, location_label, grave_type_code }`
- Admin/Empleado:
  - `POST /api/employee/burials` `{ firstName, lastName, dateOfDeath?, graveId, burialDate? }`

## Notas
- El frontend tiene proxy de desarrollo: las llamadas a `/api/*` se redirigen al backend (`http://localhost:3001`).

## Postgres
- Crea un archivo `backend/.env` a partir de `backend/.env.example` y completa tus credenciales.
- El endpoint `GET /api/health/db` hace un `SELECT 1` para validar la conexión.