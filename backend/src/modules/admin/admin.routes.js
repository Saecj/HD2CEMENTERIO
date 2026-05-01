const express = require('express');
const db = require('../../infrastructure/db');
const { requireRole, requirePermission } = require('../../middleware/auth');
const { validatePasswordStrength, hashPassword } = require('../auth/auth.service');

const EMPLOYEE_PERMISSION_KEYS = ['graves', 'deceased', 'reservations', 'payments', 'reports'];

function normalizePermissions(perms) {
	if (!Array.isArray(perms)) return [];
	const cleaned = perms
		.map((p) => String(p || '').trim())
		.filter((p) => EMPLOYEE_PERMISSION_KEYS.includes(p));
	return Array.from(new Set(cleaned));
}

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

function normalizeQuery(value) {
	return String(value || '').trim();
}

function isValidPasswordHash(value) {
	return typeof value === 'string' && value.startsWith('scrypt:');
}

function buildAdminRouter() {
	const router = express.Router();

	// Asignar rol a un usuario (MVP) para poder crear empleados sin panel complejo.
	router.post('/users/role', requireRole('admin'), async (req, res) => {
		const email = normalizeEmail(req.body?.email);
		const role = normalizeQuery(req.body?.role);
		if (!email || !email.includes('@')) return res.status(400).json({ ok: false, error: 'EMAIL_INVALID' });
		if (!['admin', 'employee', 'visitor', 'client'].includes(role)) {
			return res.status(400).json({ ok: false, error: 'ROLE_INVALID' });
		}

		const roleResult = await db.query('SELECT id FROM roles WHERE name = $1', [role]);
		const roleId = roleResult.rows[0]?.id;
		if (!roleId) return res.status(500).json({ ok: false, error: 'ROLES_NOT_INITIALIZED' });

		const userResult = await db.query(
			`INSERT INTO users (email, role_id)
			 VALUES ($1, $2)
			 ON CONFLICT (email) DO UPDATE SET role_id = EXCLUDED.role_id
			 RETURNING id, email, role_id`,
			[email, roleId],
		);

		return res.status(200).json({ ok: true, user: userResult.rows[0] });
	});

	// Crear perfil empleado asociado a un user (1:1) + rol employee
	router.post('/employees', requireRole('admin'), async (req, res) => {
		const email = normalizeEmail(req.body?.email);
		const fullName = normalizeQuery(req.body?.fullName) || null;
		const phone = normalizeQuery(req.body?.phone) || null;
		const permissions = normalizePermissions(req.body?.permissions);
		const password = String(req.body?.password || '');
		const confirmPassword = String(req.body?.confirmPassword || '');
		if (!email || !email.includes('@')) return res.status(400).json({ ok: false, error: 'EMAIL_INVALID' });

		const wantsPasswordUpdate = Boolean(password || confirmPassword);
		if (wantsPasswordUpdate) {
			if (!password || password !== confirmPassword) {
				return res.status(400).json({ ok: false, error: 'PASSWORD_MISMATCH' });
			}
			const strength = validatePasswordStrength(password);
			if (!strength.ok) {
				return res.status(400).json({ ok: false, error: strength.reason || 'PASSWORD_WEAK' });
			}
		}

		const passwordHash = wantsPasswordUpdate ? await hashPassword(password) : null;
		const defaultUsername = email.includes('@') ? email.split('@')[0].slice(0, 24) : null;

		const employeeRole = await db.query("SELECT id FROM roles WHERE name = 'employee' LIMIT 1");
		const employeeRoleId = employeeRole.rows[0]?.id;
		if (!employeeRoleId) return res.status(500).json({ ok: false, error: 'ROLES_NOT_INITIALIZED' });

		let created;
		try {
			created = await db.withTransaction(async (client) => {
			const existingUser = await client.query('SELECT id, password_hash, email_verified_at, username FROM users WHERE email = $1 LIMIT 1', [
				email,
			]);
			const hasExistingUser = existingUser.rowCount > 0;
			const existingPasswordHash = existingUser.rows[0]?.password_hash || null;
			const hasValidPassword = isValidPasswordHash(existingPasswordHash);
			if (!hasExistingUser && !passwordHash) {
				const err = new Error('PASSWORD_REQUIRED');
				err.code = 'PASSWORD_REQUIRED';
				throw err;
			}
			if (hasExistingUser && !hasValidPassword && !passwordHash) {
				const err = new Error('PASSWORD_REQUIRED');
				err.code = 'PASSWORD_REQUIRED';
				throw err;
			}

			const userResult = await client.query(
				`INSERT INTO users (email, role_id)
				 VALUES ($1, $2)
				 ON CONFLICT (email) DO UPDATE SET role_id = EXCLUDED.role_id
				 RETURNING id, email`,
				[email, employeeRoleId],
			);
			const user = userResult.rows[0];

			// Asegura username por defecto y correo verificado para poder login con password.
			await client.query(
				`UPDATE users
				 SET username = COALESCE(username, $1),
				 	email_verified_at = COALESCE(email_verified_at, now())
				 WHERE id = $2`,
				[defaultUsername, user.id],
			);

			if (passwordHash) {
				await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);
			}

			const employeeResult = await client.query(
				`INSERT INTO employees (user_id, full_name, phone, permissions)
				 VALUES ($1, $2, $3, $4)
				 ON CONFLICT (user_id) DO UPDATE
				 SET full_name = EXCLUDED.full_name,
				 	phone = EXCLUDED.phone,
				 	permissions = EXCLUDED.permissions
				 RETURNING id, user_id, full_name, phone, permissions`,
				[user.id, fullName, phone, permissions],
			);

			return { user, employee: employeeResult.rows[0] };
			});
		} catch (e) {
			const code = e?.code || e?.message;
			if (code === 'PASSWORD_REQUIRED') return res.status(400).json({ ok: false, error: 'PASSWORD_REQUIRED' });
			throw e;
		}

		// Nota: si el admin quiere que el empleado inicie sesión con password, ya quedó verificado.
		return res.status(200).json({ ok: true, ...created });
	});

	// Crear perfil cliente/visitante asociado a un user (1:1)
	router.post('/clients', requireRole('admin'), async (req, res) => {
		const email = normalizeEmail(req.body?.email);
		const fullName = normalizeQuery(req.body?.fullName) || null;
		const phone = normalizeQuery(req.body?.phone) || null;
		const documentId = normalizeQuery(req.body?.documentId) || null;
		if (!email || !email.includes('@')) return res.status(400).json({ ok: false, error: 'EMAIL_INVALID' });

		const clientRole = await db.query("SELECT id FROM roles WHERE name = 'client' LIMIT 1");
		const clientRoleId = clientRole.rows[0]?.id;
		if (!clientRoleId) return res.status(500).json({ ok: false, error: 'ROLES_NOT_INITIALIZED' });

		const created = await db.withTransaction(async (client) => {
			const userResult = await client.query(
				`INSERT INTO users (email, role_id)
				 VALUES ($1, $2)
				 ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email, role_id = EXCLUDED.role_id
				 RETURNING id, email`,
				[email, clientRoleId],
			);
			const user = userResult.rows[0];

			const clientResult = await client.query(
				`INSERT INTO clients (user_id, full_name, phone, document_id)
				 VALUES ($1, $2, $3, $4)
				 ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, document_id = EXCLUDED.document_id
				 RETURNING id, user_id, full_name, phone, document_id`,
				[user.id, fullName, phone, documentId],
			);

			return { user, client: clientResult.rows[0] };
		});

		return res.status(200).json({ ok: true, ...created });
	});

	// Listar empleados
	router.get('/employees', requireRole('admin'), async (req, res) => {
		const result = await db.query(
			`
				SELECT
					e.id,
					e.user_id,
					e.full_name,
					e.phone,
					e.permissions,
					u.email,
					(u.password_hash LIKE 'scrypt:%') AS has_password
				FROM employees e
				JOIN users u ON u.id = e.user_id
				ORDER BY e.id DESC
				LIMIT 200
			`,
		);
		return res.status(200).json({ ok: true, employees: result.rows });
	});

	// Difuntos (permiso: deceased)
	router.get('/deceased', requireRole(['admin', 'employee']), requirePermission('deceased'), async (req, res) => {
		const result = await db.query(
			`
				SELECT
					d.id,
					d.first_name,
					d.last_name,
					d.document_id,
					d.date_of_birth,
					d.date_of_death,
					b.id AS burial_id,
					b.burial_date,
					g.id AS grave_id,
					g.code AS grave_code
				FROM deceased d
				LEFT JOIN burials b ON b.deceased_id = d.id
				LEFT JOIN graves g ON g.id = b.grave_id
				ORDER BY d.id DESC
				LIMIT 200
			`,
		);
		return res.status(200).json({ ok: true, deceased: result.rows });
	});

	// Crear difunto (permiso: deceased)
	router.post('/deceased', requireRole(['admin', 'employee']), requirePermission('deceased'), async (req, res) => {
		const firstName = normalizeQuery(req.body?.firstName);
		const lastName = normalizeQuery(req.body?.lastName);
		const documentId = normalizeQuery(req.body?.documentId) || null;
		const dateOfBirth = req.body?.dateOfBirth || null;
		const dateOfDeath = req.body?.dateOfDeath || null;
		if (!firstName || !lastName) return res.status(400).json({ ok: false, error: 'NAME_REQUIRED' });

		const result = await db.query(
			`INSERT INTO deceased (first_name, last_name, document_id, date_of_birth, date_of_death)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, first_name, last_name, document_id, date_of_birth, date_of_death`,
			[firstName, lastName, documentId, dateOfBirth, dateOfDeath],
		);
		return res.status(200).json({ ok: true, deceased: result.rows[0] });
	});

	// Crear entierro para un difunto existente (permiso: deceased)
	router.post('/burials', requireRole(['admin', 'employee']), requirePermission('deceased'), async (req, res) => {
		const deceasedId = req.body?.deceasedId;
		const graveId = req.body?.graveId;
		const burialDate = req.body?.burialDate || null;
		if (!deceasedId) return res.status(400).json({ ok: false, error: 'DECEASED_REQUIRED' });
		if (!graveId) return res.status(400).json({ ok: false, error: 'GRAVE_REQUIRED' });

		const created = await db.withTransaction(async (client) => {
			const oldStatusResult = await client.query('SELECT status FROM graves WHERE id = $1', [graveId]);
			const oldStatus = oldStatusResult.rows[0]?.status;

			const burialResult = await client.query(
				`INSERT INTO burials (deceased_id, grave_id, burial_date)
				 VALUES ($1, $2, $3)
				 RETURNING id, deceased_id, grave_id, burial_date`,
				[deceasedId, graveId, burialDate],
			);

			await client.query(`UPDATE graves SET status = 'occupied', updated_at = now() WHERE id = $1`, [graveId]);
			await client.query(
				`INSERT INTO grave_status_history (grave_id, old_status, new_status, changed_by_user_id)
				 VALUES ($1, $2, $3, $4)`,
				[graveId, oldStatus, 'occupied', req.session.user.id],
			);

			return { burial: burialResult.rows[0] };
		});

		return res.status(200).json({ ok: true, ...created });
	});

	// Tipos de pago (permiso: payments o reports)
	router.get('/payment-types', requireRole(['admin', 'employee']), requirePermission(['payments', 'reports']), async (req, res) => {
		try {
			await db.query(
				`
					INSERT INTO payment_types (name)
					VALUES ('cash'), ('card_credit'), ('card_debit')
					ON CONFLICT (name) DO NOTHING
				`,
			);
		} catch {
			// Ignorar (DB no lista / tabla no existe todavía)
		}
		const result = await db.query('SELECT id, name FROM payment_types ORDER BY name ASC');
		return res.status(200).json({ ok: true, paymentTypes: result.rows });
	});

	// Reservas (GET: reservations o reports)
	router.get('/reservations', requireRole(['admin', 'employee']), requirePermission(['reservations', 'reports']), async (req, res) => {
		const hasReservedName = await db
			.query(
				`
					SELECT 1
					FROM information_schema.columns
					WHERE table_name = 'reservations'
					  AND column_name = 'reserved_deceased_full_name'
					LIMIT 1
				`,
			)
			.then((r) => (r.rowCount || 0) > 0);

		const result = await db.query(
			hasReservedName
				?	`
					SELECT
						r.id,
						r.reservation_code,
						r.client_id,
						r.grave_id,
						r.reserved_from,
						r.reserved_to,
						r.status,
						r.created_at,
						r.reserved_deceased_full_name AS deceased_full_name,
						g.code AS grave_code,
						u.email AS client_email
					FROM reservations r
					JOIN clients c ON c.id = r.client_id
					JOIN users u ON u.id = c.user_id
					JOIN graves g ON g.id = r.grave_id
					ORDER BY r.id DESC
					LIMIT 200
				`
				:	`
					SELECT
						r.id,
						r.reservation_code,
						r.client_id,
						r.grave_id,
						r.reserved_from,
						r.reserved_to,
						r.status,
						r.created_at,
						NULL::text AS deceased_full_name,
						g.code AS grave_code,
						u.email AS client_email
					FROM reservations r
					JOIN clients c ON c.id = r.client_id
					JOIN users u ON u.id = c.user_id
					JOIN graves g ON g.id = r.grave_id
					ORDER BY r.id DESC
					LIMIT 200
				`,
		);
		return res.status(200).json({ ok: true, reservations: result.rows });
	});

	// Reservas (write: reservations)
	router.post('/reservations', requireRole(['admin', 'employee']), requirePermission('reservations'), async (req, res) => {
		const clientEmail = normalizeEmail(req.body?.clientEmail);
		const graveId = req.body?.graveId;
		const reservedFrom = req.body?.reservedFrom || null;
		const reservedTo = req.body?.reservedTo || null;
		const status = normalizeQuery(req.body?.status) || 'pending';

		if (!clientEmail || !clientEmail.includes('@')) return res.status(400).json({ ok: false, error: 'EMAIL_INVALID' });
		if (!graveId) return res.status(400).json({ ok: false, error: 'GRAVE_REQUIRED' });
		if (!['pending', 'confirmed', 'cancelled', 'expired'].includes(status)) {
			return res.status(400).json({ ok: false, error: 'STATUS_INVALID' });
		}

		const clientResult = await db.query(
			`SELECT c.id AS client_id
			 FROM clients c
			 JOIN users u ON u.id = c.user_id
			 WHERE u.email = $1
			 LIMIT 1`,
			[clientEmail],
		);
		const clientId = clientResult.rows[0]?.client_id;
		if (!clientId) return res.status(400).json({ ok: false, error: 'CLIENT_NOT_FOUND' });

		const created = await db.query(
			`INSERT INTO reservations (client_id, grave_id, reserved_from, reserved_to, status)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, client_id, grave_id, reserved_from, reserved_to, status, created_at`,
			[clientId, graveId, reservedFrom, reservedTo, status],
		);

		return res.status(200).json({ ok: true, reservation: created.rows[0] });
	});

	// Reservas (write: reservations)
	router.patch('/reservations/:id', requireRole(['admin', 'employee']), requirePermission('reservations'), async (req, res) => {
		const id = Number(req.params.id);
		const status = normalizeQuery(req.body?.status);
		if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'ID_INVALID' });
		if (!['pending', 'confirmed', 'cancelled', 'expired'].includes(status)) {
			return res.status(400).json({ ok: false, error: 'STATUS_INVALID' });
		}

		const updated = await db.withTransaction(async (client) => {
			const currentResult = await client.query(
				`SELECT id, grave_id, status, reservation_code
				 FROM reservations
				 WHERE id = $1
				 FOR UPDATE`,
				[id],
			);
			const current = currentResult.rows[0];
			if (!current) return null;

			const result = await client.query(
				`UPDATE reservations
				 SET status = $1
				 WHERE id = $2
				 RETURNING id, reservation_code, client_id, grave_id, reserved_from, reserved_to, status, created_at`,
				[status, id],
			);
			const reservation = result.rows[0];

			// Admin "habilita" la reserva: al confirmar, marcamos la tumba como reserved.
			if (current.status !== status) {
				if (status === 'confirmed') {
					const graveResult = await client.query('SELECT status FROM graves WHERE id = $1 FOR UPDATE', [current.grave_id]);
					const oldStatus = graveResult.rows[0]?.status;
					if (oldStatus === 'available') {
						await client.query(`UPDATE graves SET status = 'reserved', updated_at = now() WHERE id = $1`, [current.grave_id]);
						await client.query(
							`INSERT INTO grave_status_history (grave_id, old_status, new_status, changed_by_user_id)
							 VALUES ($1, $2, $3, $4)`,
							[current.grave_id, oldStatus, 'reserved', req.session.user.id],
						);
					}
				}

				if (status === 'cancelled' || status === 'expired') {
					const graveResult = await client.query('SELECT status FROM graves WHERE id = $1 FOR UPDATE', [current.grave_id]);
					const oldStatus = graveResult.rows[0]?.status;
					if (oldStatus === 'reserved') {
						await client.query(`UPDATE graves SET status = 'available', updated_at = now() WHERE id = $1`, [current.grave_id]);
						await client.query(
							`INSERT INTO grave_status_history (grave_id, old_status, new_status, changed_by_user_id)
							 VALUES ($1, $2, $3, $4)`,
							[current.grave_id, oldStatus, 'available', req.session.user.id],
						);
					}
				}
			}

			return reservation;
		});

		if (!updated) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
		return res.status(200).json({ ok: true, reservation: updated });
	});

	// Pagos (GET: payments o reports)
	router.get('/payments', requireRole(['admin', 'employee']), requirePermission(['payments', 'reports']), async (req, res) => {
		const result = await db.query(
			`
				SELECT
					p.id,
					p.client_id,
					p.reservation_id,
					p.payment_type_id,
					pt.name AS payment_type_name,
					p.amount_cents,
					p.currency,
					p.status,
					p.paid_at,
					p.created_at,
					u.email AS client_email
				FROM payments p
				JOIN payment_types pt ON pt.id = p.payment_type_id
				JOIN clients c ON c.id = p.client_id
				JOIN users u ON u.id = c.user_id
				ORDER BY p.id DESC
				LIMIT 200
			`,
		);
		return res.status(200).json({ ok: true, payments: result.rows });
	});

	// Pagos (write: payments)
	router.post('/payments', requireRole(['admin', 'employee']), requirePermission('payments'), async (req, res) => {
		const clientEmail = normalizeEmail(req.body?.clientEmail);
		const reservationId = req.body?.reservationId ?? null;
		const paymentTypeId = req.body?.paymentTypeId;
		const amountCents = Number(req.body?.amountCents);
		const currency = normalizeQuery(req.body?.currency) || 'PEN';
		const status = normalizeQuery(req.body?.status) || 'pending';

		if (!clientEmail || !clientEmail.includes('@')) return res.status(400).json({ ok: false, error: 'EMAIL_INVALID' });
		if (!paymentTypeId) return res.status(400).json({ ok: false, error: 'PAYMENT_TYPE_REQUIRED' });
		if (!Number.isFinite(amountCents) || amountCents <= 0) return res.status(400).json({ ok: false, error: 'AMOUNT_INVALID' });
		if (!['pending', 'paid', 'void'].includes(status)) return res.status(400).json({ ok: false, error: 'STATUS_INVALID' });

		const clientResult = await db.query(
			`SELECT c.id AS client_id
			 FROM clients c
			 JOIN users u ON u.id = c.user_id
			 WHERE u.email = $1
			 LIMIT 1`,
			[clientEmail],
		);
		const clientId = clientResult.rows[0]?.client_id;
		if (!clientId) return res.status(400).json({ ok: false, error: 'CLIENT_NOT_FOUND' });

		const paidAt = status === 'paid' ? new Date() : null;
		const created = await db.query(
			`INSERT INTO payments (client_id, reservation_id, payment_type_id, amount_cents, currency, status, paid_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 RETURNING id, client_id, reservation_id, payment_type_id, amount_cents, currency, status, paid_at, created_at`,
			[clientId, reservationId, paymentTypeId, amountCents, currency, status, paidAt],
		);
		return res.status(200).json({ ok: true, payment: created.rows[0] });
	});

	// Pagos (write: payments)
	router.patch('/payments/:id', requireRole(['admin', 'employee']), requirePermission('payments'), async (req, res) => {
		const id = Number(req.params.id);
		const status = normalizeQuery(req.body?.status);
		if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'ID_INVALID' });
		if (!['pending', 'paid', 'void'].includes(status)) return res.status(400).json({ ok: false, error: 'STATUS_INVALID' });

		const paidAt = status === 'paid' ? new Date() : null;
		const result = await db.query(
			`UPDATE payments
			 SET status = $1,
			 	paid_at = CASE WHEN $1 = 'paid' THEN COALESCE(paid_at, $2) ELSE NULL END
			 WHERE id = $3
			 RETURNING id, client_id, reservation_id, payment_type_id, amount_cents, currency, status, paid_at, created_at`,
			[status, paidAt, id],
		);
		if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
		return res.status(200).json({ ok: true, payment: result.rows[0] });
	});

	return router;
}

module.exports = {
	buildAdminRouter,
};
