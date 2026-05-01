-- Add reservation codes and prevent double-booking active reservations

ALTER TABLE reservations
	ADD COLUMN IF NOT EXISTS reservation_code TEXT;

-- Backfill existing rows deterministically (unique by id)
UPDATE reservations
SET reservation_code = 'RSV-' || LPAD(id::text, 8, '0')
WHERE reservation_code IS NULL;

-- Enforce not-null + uniqueness
ALTER TABLE reservations
	ALTER COLUMN reservation_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reservations_code_ux
	ON reservations (reservation_code);

-- Prevent multiple active reservations for the same grave
CREATE UNIQUE INDEX IF NOT EXISTS reservations_grave_active_ux
	ON reservations (grave_id)
	WHERE status IN ('pending', 'confirmed');
