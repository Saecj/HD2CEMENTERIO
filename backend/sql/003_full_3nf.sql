-- 3NF core tables for Cliente/Admin modules

-- Tipos
CREATE TABLE IF NOT EXISTS grave_types (
	id BIGSERIAL PRIMARY KEY,
	name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS payment_types (
	id BIGSERIAL PRIMARY KEY,
	name TEXT NOT NULL UNIQUE
);

-- Ubicaciones (geolocalización / sectorización)
CREATE TABLE IF NOT EXISTS locations (
	id BIGSERIAL PRIMARY KEY,
	sector_id BIGINT REFERENCES sectors(id),
	row_number INT,
	col_number INT,
	latitude DOUBLE PRECISION,
	longitude DOUBLE PRECISION,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT locations_lat_check CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
	CONSTRAINT locations_lng_check CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

-- Evita duplicar ubicaciones por sector/fila/col (si alguno es NULL, Postgres permite múltiples)
CREATE UNIQUE INDEX IF NOT EXISTS locations_sector_row_col_ux
	ON locations (sector_id, row_number, col_number);

-- Ajuste de tumbas: referencia a location + tipo (evita duplicar sector/fila/col dentro de graves)
ALTER TABLE graves
	ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id);

ALTER TABLE graves
	ADD COLUMN IF NOT EXISTS grave_type_id BIGINT REFERENCES grave_types(id);

-- Migración de datos (si ya existían graves con sector/fila/col)
INSERT INTO locations (sector_id, row_number, col_number)
SELECT DISTINCT g.sector_id, g.row_number, g.col_number
FROM graves g
WHERE (g.sector_id IS NOT NULL OR g.row_number IS NOT NULL OR g.col_number IS NOT NULL)
	AND NOT EXISTS (
		SELECT 1
		FROM locations l
		WHERE l.sector_id IS NOT DISTINCT FROM g.sector_id
			AND l.row_number IS NOT DISTINCT FROM g.row_number
			AND l.col_number IS NOT DISTINCT FROM g.col_number
	);

UPDATE graves g
SET location_id = l.id
FROM locations l
WHERE g.location_id IS NULL
	AND l.sector_id IS NOT DISTINCT FROM g.sector_id
	AND l.row_number IS NOT DISTINCT FROM g.row_number
	AND l.col_number IS NOT DISTINCT FROM g.col_number;

-- Ya no usamos estas columnas en 3NF (queda todo en locations)
ALTER TABLE graves DROP COLUMN IF EXISTS sector_id;
ALTER TABLE graves DROP COLUMN IF EXISTS row_number;
ALTER TABLE graves DROP COLUMN IF EXISTS col_number;

-- Historial de cambios de estado de tumba
CREATE TABLE IF NOT EXISTS grave_status_history (
	id BIGSERIAL PRIMARY KEY,
	grave_id BIGINT NOT NULL REFERENCES graves(id),
	old_status TEXT,
	new_status TEXT NOT NULL,
	changed_by_user_id BIGINT REFERENCES users(id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS grave_status_history_grave_idx
	ON grave_status_history (grave_id, created_at DESC);

-- Perfiles (1:1 con users) para normalizar atributos
CREATE TABLE IF NOT EXISTS employees (
	id BIGSERIAL PRIMARY KEY,
	user_id BIGINT NOT NULL UNIQUE REFERENCES users(id),
	full_name TEXT,
	phone TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
	id BIGSERIAL PRIMARY KEY,
	user_id BIGINT NOT NULL UNIQUE REFERENCES users(id),
	full_name TEXT,
	document_id TEXT,
	phone TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reservas
CREATE TABLE IF NOT EXISTS reservations (
	id BIGSERIAL PRIMARY KEY,
	client_id BIGINT NOT NULL REFERENCES clients(id),
	grave_id BIGINT NOT NULL REFERENCES graves(id),
	reserved_from DATE,
	reserved_to DATE,
	status TEXT NOT NULL DEFAULT 'pending',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT reservations_status_check CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired'))
);

CREATE INDEX IF NOT EXISTS reservations_client_idx
	ON reservations (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reservations_grave_idx
	ON reservations (grave_id, created_at DESC);

-- Pagos
CREATE TABLE IF NOT EXISTS payments (
	id BIGSERIAL PRIMARY KEY,
	client_id BIGINT NOT NULL REFERENCES clients(id),
	reservation_id BIGINT REFERENCES reservations(id),
	payment_type_id BIGINT NOT NULL REFERENCES payment_types(id),
	amount_cents BIGINT NOT NULL,
	currency TEXT NOT NULL DEFAULT 'PEN',
	status TEXT NOT NULL DEFAULT 'pending',
	paid_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT payments_amount_check CHECK (amount_cents > 0),
	CONSTRAINT payments_status_check CHECK (status IN ('pending', 'paid', 'void'))
);

CREATE INDEX IF NOT EXISTS payments_client_idx
	ON payments (client_id, created_at DESC);

-- Comprobantes
CREATE TABLE IF NOT EXISTS receipts (
	id BIGSERIAL PRIMARY KEY,
	payment_id BIGINT NOT NULL UNIQUE REFERENCES payments(id),
	receipt_number TEXT NOT NULL UNIQUE,
	issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	payload JSONB
);

-- Reportes (metadatos de reportes generados)
CREATE TABLE IF NOT EXISTS reports (
	id BIGSERIAL PRIMARY KEY,
	report_type TEXT NOT NULL,
	created_by_user_id BIGINT REFERENCES users(id),
	parameters JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_type_idx
	ON reports (report_type, created_at DESC);

-- Seeds mínimos
INSERT INTO grave_types (name) VALUES ('standard')
	ON CONFLICT (name) DO NOTHING;
INSERT INTO payment_types (name) VALUES ('cash')
	ON CONFLICT (name) DO NOTHING;
