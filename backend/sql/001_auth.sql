CREATE TABLE IF NOT EXISTS roles (
	id BIGSERIAL PRIMARY KEY,
	name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
	id BIGSERIAL PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	role_id BIGINT NOT NULL REFERENCES roles(id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_email_codes (
	id BIGSERIAL PRIMARY KEY,
	email TEXT NOT NULL,
	code_hash TEXT NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	consumed_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_email_codes_lookup_idx
	ON auth_email_codes (email, created_at DESC);

INSERT INTO roles (name) VALUES ('admin')
	ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('employee')
	ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('visitor')
	ON CONFLICT (name) DO NOTHING;
