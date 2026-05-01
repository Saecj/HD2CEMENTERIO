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
