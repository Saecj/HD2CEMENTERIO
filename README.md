# 🪦 Sistema Web de Gestión de Cementerios (Monorepo)

## 📌 Descripción

Sistema web orientado a la gestión integral de cementerios, permitiendo administrar tumbas, difuntos, reservas, pagos y ubicación mediante geolocalización.

El sistema está diseñado bajo arquitectura cliente-servidor, facilitando la centralización de información y mejorando la experiencia del usuario.

---

## ⚙️ Requisitos

* Node.js (versión LTS recomendada)
* PostgreSQL

---

## 📦 Instalación

### 1. Instalar dependencias

Desde la raíz del proyecto:

```bash
npm run install:all
```

---

### 2. Configurar base de datos

1. Crear archivo `.env`:

```bash
backend/.env
```

2. Basarse en:

```bash
backend/.env.example
```

3. Ejecutar migraciones:

```bash
npm --prefix backend run db:migrate
```

---

## 🚀 Ejecución del sistema

Desde la raíz:

```bash
npm run dev
```

---

### 📍 Servicios

* Frontend: http://localhost:5173
* Backend: http://localhost:3001

Endpoints útiles:

* Health: http://localhost:3001/health
* Health DB: http://localhost:3001/api/health/db

---

## 🔐 Autenticación

Endpoints principales:

* Registro:

```bash
POST /api/auth/register
```

* Verificación:

```bash
POST /api/auth/verify-email
```

* Login:

```bash
POST /api/auth/login
```

* Usuario actual:

```bash
GET /api/auth/me
```

---

## 🔍 Funcionalidades principales

✔ Gestión de tumbas
✔ Registro de difuntos
✔ Búsqueda de difuntos
✔ Visualización de ubicación
✔ Sistema de reservas
✔ Control de pagos
✔ Gestión de usuarios

---

## 🧭 Manual de Usuario

### 🔹 1. Acceso al sistema

El usuario ingresa a la plataforma mediante su correo y contraseña.

### 🔹 2. Búsqueda de difuntos

Se ingresa el nombre del difunto para visualizar su información y ubicación.

### 🔹 3. Visualización del estado

Permite ver:

* Estado de la tumba
* Estado de la reserva
* Estado del pago

### 🔹 4. Reservas

El usuario puede seleccionar tumbas disponibles y realizar una reserva.

### 🔹 5. Pagos

Permite registrar y consultar pagos asociados a reservas.

---

## 🏗️ Arquitectura

El sistema sigue el patrón:

* Modelo → lógica y base de datos
* Vista → interfaz de usuario
* Controlador → gestión de peticiones

---

## 🗄️ Base de datos

Principales entidades:

* users
* roles
* graves
* deceased
* reservations
* payments
* sectors
* locations

---

## ⚠️ Notas

* El frontend usa proxy para `/api`
* Se recomienda conexión estable a internet
* Endpoint `/api/health/db` valida conexión a PostgreSQL

---

## 💡 Innovación y valor agregado

* Geolocalización de tumbas
* Centralización de información
* Reducción del tiempo de búsqueda
* Escalabilidad del sistema
* Posible integración futura con:

  * Aplicación móvil
  * Códigos QR
  * Notificaciones automáticas

---

## 👨‍💻 Autor

Proyecto desarrollado como parte del curso de Herramientas de Desarrollo – UTP.
