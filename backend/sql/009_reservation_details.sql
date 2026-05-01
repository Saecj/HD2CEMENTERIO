-- Guarda datos ingresados por el cliente al reservar
-- (nombre del difunto y otros detalles de la reserva)

ALTER TABLE reservations
	ADD COLUMN IF NOT EXISTS reserved_deceased_full_name TEXT;
