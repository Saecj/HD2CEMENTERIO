-- Permisos por empleado (qué módulos puede ver/gestionar en el panel)
-- Guardamos un arreglo de claves (p.ej. graves, deceased, reservations, payments, reports)

ALTER TABLE employees
	ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
