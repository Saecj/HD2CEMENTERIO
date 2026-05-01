CREATE TABLE IF NOT EXISTS sectors (
	id BIGSERIAL PRIMARY KEY,
	name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS graves (
	id BIGSERIAL PRIMARY KEY,
	code TEXT NOT NULL UNIQUE,
	sector_id BIGINT REFERENCES sectors(id),
	row_number INT,
	col_number INT,
	status TEXT NOT NULL DEFAULT 'available',
	notes TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT graves_status_check CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance'))
);

CREATE TABLE IF NOT EXISTS deceased (
	id BIGSERIAL PRIMARY KEY,
	first_name TEXT NOT NULL,
	last_name TEXT NOT NULL,
	document_id TEXT,
	date_of_birth DATE,
	date_of_death DATE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS burials (
	id BIGSERIAL PRIMARY KEY,
	deceased_id BIGINT NOT NULL REFERENCES deceased(id),
	grave_id BIGINT NOT NULL REFERENCES graves(id),
	burial_date DATE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT burials_deceased_unique UNIQUE (deceased_id)
);

CREATE INDEX IF NOT EXISTS deceased_name_idx
	ON deceased (last_name, first_name);

CREATE INDEX IF NOT EXISTS graves_sector_idx
	ON graves (sector_id);

CREATE INDEX IF NOT EXISTS burials_grave_idx
	ON burials (grave_id);
