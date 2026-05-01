-- Email verification + pending client registrations

ALTER TABLE users
	ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS pending_client_registrations (
	email TEXT PRIMARY KEY,
	password_hash TEXT NOT NULL,
	document_id TEXT NOT NULL,
	phone TEXT,
	code_hash TEXT NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_client_registrations_expires_idx
	ON pending_client_registrations (expires_at);
