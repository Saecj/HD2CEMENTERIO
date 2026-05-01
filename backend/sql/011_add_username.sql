-- Add username field for users + pending client registrations

ALTER TABLE users
	ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE pending_client_registrations
	ADD COLUMN IF NOT EXISTS username TEXT;

-- Backfill existing users to have a usable username
UPDATE users
SET username = split_part(email, '@', 1)
WHERE username IS NULL;

-- Backfill pending registrations too (safe default)
UPDATE pending_client_registrations
SET username = split_part(email, '@', 1)
WHERE username IS NULL;
