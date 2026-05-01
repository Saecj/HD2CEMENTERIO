-- 008: Campos para publicar/ocultar tumbas y precio

ALTER TABLE graves
	ADD COLUMN IF NOT EXISTS price_cents BIGINT NOT NULL DEFAULT 0;

ALTER TABLE graves
	ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE graves
	ADD CONSTRAINT graves_price_check CHECK (price_cents >= 0);
