const express = require('express');
const crypto = require('node:crypto');
const db = require('../../infrastructure/db');
const { requireAuth, requireRole, requirePermission } = require('../../middleware/auth');

function normalizeQuery(value) {
	return String(value || '').trim();
}

function buildCemeteryRouter() {
	const router = express.Router();

	function toOptionalBigInt(value) {
		if (value == null || value === '') return null;
		const n = Number(value);
		return Number.isFinite(n) ? n : null;
	}

	async function ensurePaymentTypes() {
		try {
			await db.query(
				`
					INSERT INTO payment_types (name)
					VALUES ('cash'), ('card_credit'), ('card_debit')
					ON CONFLICT (name) DO NOTHING
				`,
			);
		} catch {
			// Si la tabla aún no existe o la DB está caída, dejamos que el select falle y reporte.
		}
	}

	async function reservationsHasReservedDeceasedNameColumn() {
		// Consultamos siempre para evitar quedar “pegados” si una migración se aplica en caliente.
		// Es un query muy barato y el panel/cliente no hace una carga masiva.
		return db
			.query(
				`
					SELECT 1
					FROM information_schema.columns
					WHERE table_schema = 'public'
						AND table_name = 'reservations'
						AND column_name = 'reserved_deceased_full_name'
					LIMIT 1
				`,
			)
			.then((r) => r.rowCount > 0)
			.catch(() => false);
	}

	function generateReservationCode() {
		// Cód. corto y fácil de transcribir (hex en mayúsculas)
		return `RSV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
	}

	router.get('/search', requireAuth, async (req, res) => {
		const query = normalizeQuery(req.query?.q ?? req.query?.query);
		if (!query || query.length < 2) {
			return res.status(400).json({ ok: false, error: 'QUERY_TOO_SHORT' });
		}

		const like = `%${query}%`;
		const result = await db.query(
			`
				SELECT
					d.id AS deceased_id,
					d.first_name,
					d.last_name,
					d.date_of_death,
					g.id AS grave_id,
					g.code AS grave_code,
					g.status AS grave_status,
					g.price_cents,
					g.is_enabled,
					s.name AS sector_name,
					l.row_number,
					l.col_number,
					l.latitude,
					l.longitude
				FROM deceased d
				LEFT JOIN burials b ON b.deceased_id = d.id
				LEFT JOIN graves g ON g.id = b.grave_id
				LEFT JOIN locations l ON l.id = g.location_id
				LEFT JOIN sectors s ON s.id = l.sector_id
				WHERE
					(
						(d.first_name ILIKE $1 OR d.last_name ILIKE $1 OR (d.first_name || ' ' || d.last_name) ILIKE $1)
						OR (g.code ILIKE $1)
					)
					AND (g.id IS NULL OR g.is_enabled IS DISTINCT FROM false)
				ORDER BY d.last_name ASC, d.first_name ASC
				LIMIT 20
			`,
			[like],
		);

		return res.status(200).json({ ok: true, results: result.rows, items: result.rows });
	});

	// Tipos de pago (para cliente/visitante autenticado)
	router.get('/payment-types', requireAuth, async (req, res) => {
		await ensurePaymentTypes();
		const result = await db.query('SELECT id, name FROM payment_types ORDER BY name ASC');
		return res.status(200).json({ ok: true, paymentTypes: result.rows });
	});

	async function getClientIdOrNull(userId) {
		const clientResult = await db.query('SELECT id FROM clients WHERE user_id = $1 LIMIT 1', [userId]);
		return clientResult.rows[0]?.id ?? null;
	}

	// Cliente: ver datos del perfil (si corresponde)
	router.get('/client/profile', requireAuth, async (req, res) => {
		const userId = req.session.user.id;
		const result = await db.query(
			`SELECT id, user_id, full_name, phone, document_id
			 FROM clients
			 WHERE user_id = $1
			 LIMIT 1`,
			[userId],
		);
		return res.status(200).json({ ok: true, client: result.rows[0] || null });
	});

	// Cliente: editar datos del perfil
	router.put('/client/profile', requireAuth, async (req, res) => {
		const userId = req.session.user.id;
		const existing = await db.query(
			`SELECT id
			 FROM clients
			 WHERE user_id = $1
			 LIMIT 1`,
			[userId],
		);
		const clientId = existing.rows[0]?.id;
		if (!clientId) return res.status(403).json({ ok: false, error: 'CLIENT_REQUIRED' });

		const usernameRaw = String(req.body?.username ?? '').trim();
		const username = usernameRaw ? usernameRaw : null;
		const fullName = String(req.body?.fullName ?? req.body?.full_name ?? '').trim() || null;
		const phone = String(req.body?.phone ?? '').trim() || null;
		const documentId = String(req.body?.documentId ?? req.body?.document_id ?? '').trim() || null;

		if (username && (username.length < 2 || username.length > 24)) {
			return res.status(400).json({ ok: false, error: 'USERNAME_INVALID' });
		}
		if (fullName && fullName.length > 200) return res.status(400).json({ ok: false, error: 'FULL_NAME_TOO_LONG' });
		if (phone && phone.length > 40) return res.status(400).json({ ok: false, error: 'PHONE_TOO_LONG' });
		if (documentId && documentId.length > 32) return res.status(400).json({ ok: false, error: 'DNI_TOO_LONG' });

		if (username) {
			await db.query('UPDATE users SET username = $1 WHERE id = $2', [username, userId]);
			// Mantener la sesión actualizada (para /api/auth/me)
			if (req.session?.user) req.session.user.username = username;
		}

		const updated = await db.query(
			`UPDATE clients
			 SET full_name = $1,
			 	phone = $2,
			 	document_id = $3
			 WHERE id = $4
			 RETURNING id, user_id, full_name, phone, document_id`,
			[fullName, phone, documentId, clientId],
		);

		return res.status(200).json({ ok: true, client: updated.rows[0] || null });
	});

	// Cliente: crear reserva (queda pending hasta que Admin la habilite)
	router.post('/client/reservations', requireAuth, async (req, res) => {
		const userId = req.session.user.id;
		const clientId = await getClientIdOrNull(userId);
		if (!clientId) return res.status(403).json({ ok: false, error: 'CLIENT_REQUIRED' });

		const graveId = req.body?.graveId != null ? Number(req.body?.graveId) : null;
		const graveCode = normalizeQuery(req.body?.graveCode);
		const deceasedFullNameRaw = normalizeQuery(req.body?.deceasedFullName);
		const reservedDeceasedFullName = deceasedFullNameRaw || null;
		const reservedFrom = req.body?.reservedFrom || null;
		const reservedTo = req.body?.reservedTo || null;
		if (!Number.isFinite(graveId) && !graveCode) return res.status(400).json({ ok: false, error: 'GRAVE_REQUIRED' });
		if (reservedDeceasedFullName && reservedDeceasedFullName.length > 200) {
			return res.status(400).json({ ok: false, error: 'DECEASED_NAME_TOO_LONG' });
		}

		try {
			const hasReservedName = await reservationsHasReservedDeceasedNameColumn();
			const created = await db.withTransaction(async (client) => {
				const graveResult = graveId
					? await client.query('SELECT id, code, status, is_enabled FROM graves WHERE id = $1 LIMIT 1 FOR UPDATE', [graveId])
					: await client.query('SELECT id, code, status, is_enabled FROM graves WHERE code = $1 LIMIT 1 FOR UPDATE', [graveCode]);
				const grave = graveResult.rows[0];
				if (!grave) {
					const err = new Error('GRAVE_NOT_FOUND');
					err.code = 'GRAVE_NOT_FOUND';
					throw err;
				}
				if (grave.status !== 'available') {
					const err = new Error('GRAVE_NOT_AVAILABLE');
					err.code = 'GRAVE_NOT_AVAILABLE';
					throw err;
				}
				if (grave.is_enabled === false) {
					const err = new Error('GRAVE_DISABLED');
					err.code = 'GRAVE_DISABLED';
					throw err;
				}

				let reservation;
				// Intentos mínimos para evitar colisión de código (muy improbable).
				// Importante: no usamos excepciones para reintentar dentro de una transacción,
				// porque en Postgres eso deja la transacción abortada (25P02).
				for (let i = 0; i < 5; i++) {
					const code = generateReservationCode();
					const result = hasReservedName
						? await client.query(
							`INSERT INTO reservations (client_id, grave_id, reserved_from, reserved_to, status, reservation_code, reserved_deceased_full_name)
							 VALUES ($1, $2, $3, $4, 'pending', $5, $6)
							 ON CONFLICT DO NOTHING
							 RETURNING id, client_id, grave_id, reserved_from, reserved_to, status, reservation_code, reserved_deceased_full_name, created_at`,
							[clientId, grave.id, reservedFrom, reservedTo, code, reservedDeceasedFullName],
						)
						: await client.query(
							`INSERT INTO reservations (client_id, grave_id, reserved_from, reserved_to, status, reservation_code)
							 VALUES ($1, $2, $3, $4, 'pending', $5)
							 ON CONFLICT DO NOTHING
							 RETURNING id, client_id, grave_id, reserved_from, reserved_to, status, reservation_code, created_at`,
							[clientId, grave.id, reservedFrom, reservedTo, code],
						);
					reservation = result.rows[0];
					if (reservation) break;

					// Si no insertó, puede ser colisión de código O que ya exista una reserva activa para la tumba.
					const active = await client.query(
						`SELECT 1
						 FROM reservations
						 WHERE grave_id = $1 AND status IN ('pending','confirmed')
						 LIMIT 1`,
						[grave.id],
					);
					if (active.rowCount > 0) {
						const err = new Error('GRAVE_ALREADY_RESERVED');
						err.code = 'GRAVE_ALREADY_RESERVED';
						throw err;
					}
				}
				if (!reservation) {
					const err = new Error('RESERVATION_CODE_GENERATION_FAILED');
					err.code = 'RESERVATION_CODE_GENERATION_FAILED';
					throw err;
				}
				return reservation;
			});

			return res.status(200).json({ ok: true, reservation: created });
		} catch (e) {
			if (e?.code === 'GRAVE_NOT_FOUND') return res.status(404).json({ ok: false, error: 'GRAVE_NOT_FOUND' });
			if (e?.code === 'GRAVE_NOT_AVAILABLE') return res.status(409).json({ ok: false, error: 'GRAVE_NOT_AVAILABLE' });
			if (e?.code === 'GRAVE_DISABLED') return res.status(409).json({ ok: false, error: 'GRAVE_DISABLED' });
			if (e?.code === 'GRAVE_ALREADY_RESERVED') return res.status(409).json({ ok: false, error: 'GRAVE_ALREADY_RESERVED' });
			throw e;
		}
	});

	// Público: listar tumbas disponibles para reservar (solo lectura)
	router.get('/client/available-graves', async (req, res) => {
		const result = await db.query(
			`
				SELECT
					g.id,
					g.code,
					g.status,
					g.price_cents,
					g.is_enabled,
					s.name AS sector_name,
					l.row_number,
					l.col_number,
					l.latitude,
					l.longitude
				FROM graves g
				LEFT JOIN locations l ON l.id = g.location_id
				LEFT JOIN sectors s ON s.id = l.sector_id
				WHERE
					g.status = 'available'
					AND g.is_enabled IS DISTINCT FROM false
					AND NOT EXISTS (
						SELECT 1
						FROM reservations r
						WHERE r.grave_id = g.id
							AND r.status IN ('pending', 'confirmed')
					)
				ORDER BY s.name ASC NULLS LAST, l.row_number ASC NULLS LAST, l.col_number ASC NULLS LAST, g.id ASC
				LIMIT 500
			`,
		);
		return res.status(200).json({ ok: true, graves: result.rows });
	});

	// Público: mapa de tumbas por sector (solo lectura)
	router.get('/client/grave-map', async (req, res) => {
		const requestedSectorId = toOptionalBigInt(req.query?.sectorId);
		const sectorsResult = await db.query('SELECT id, name FROM sectors ORDER BY name ASC');
		const sectors = sectorsResult.rows;
		if (sectors.length === 0) return res.status(200).json({ ok: true, sectors: [], sectorId: null, graves: [] });

		const sectorId = requestedSectorId ?? sectors[0].id;
		const gravesResult = await db.query(
			`
				SELECT
					g.id,
					g.code,
					g.status AS grave_status,
					g.price_cents,
					g.is_enabled,
					g.grave_type_id,
					gt.name AS grave_type_name,
					l.sector_id,
					s.name AS sector_name,
					l.row_number,
					l.col_number,
					ar.id AS active_reservation_id,
					ar.status AS active_reservation_status,
					ar.reservation_code AS active_reservation_code,
					(occ.burial_id IS NOT NULL) AS has_burial
				FROM graves g
				LEFT JOIN grave_types gt ON gt.id = g.grave_type_id
				LEFT JOIN locations l ON l.id = g.location_id
				LEFT JOIN sectors s ON s.id = l.sector_id
				LEFT JOIN LATERAL (
					SELECT r.id, r.status, r.reservation_code
					FROM reservations r
					WHERE r.grave_id = g.id
						AND r.status IN ('pending','confirmed')
					ORDER BY r.id DESC
					LIMIT 1
				) ar ON true
				LEFT JOIN LATERAL (
					SELECT b.id AS burial_id
					FROM burials b
					WHERE b.grave_id = g.id
					ORDER BY b.id DESC
					LIMIT 1
				) occ ON true
				WHERE l.sector_id = $1
					AND g.is_enabled IS DISTINCT FROM false
				ORDER BY l.row_number ASC NULLS LAST, l.col_number ASC NULLS LAST, g.id ASC
			`,
			[sectorId],
		);

		return res.status(200).json({ ok: true, sectors, sectorId, graves: gravesResult.rows });
	});

	// Cliente: resumen de pago de una reserva (para mostrar "te falta pagar" y precargar modal)
	router.get('/client/reservations/payment-summary', requireAuth, async (req, res) => {
		const userId = req.session.user.id;
		const clientId = await getClientIdOrNull(userId);
		if (!clientId) return res.status(403).json({ ok: false, error: 'CLIENT_REQUIRED' });

		const reservationCode = normalizeQuery(req.query?.reservationCode);
		if (!reservationCode) return res.status(400).json({ ok: false, error: 'RESERVATION_CODE_REQUIRED' });

		const hasReservedName = await reservationsHasReservedDeceasedNameColumn();
		const result = await db.query(
			hasReservedName
				? `
					SELECT
						r.id,
						r.reservation_code,
						r.status AS reservation_status,
						r.reserved_from,
						r.reserved_to,
						g.id AS grave_id,
						g.code AS grave_code,
						g.price_cents,
						s.name AS sector_name,
						l.row_number,
						l.col_number,
						COALESCE(r.reserved_deceased_full_name, occ.deceased_full_name) AS deceased_full_name,
						COALESCE(pay.paid_cents, 0) AS paid_cents,
						COALESCE(pay.pending_cents, 0) AS pending_cents,
						GREATEST(COALESCE(g.price_cents, 0) - (COALESCE(pay.paid_cents, 0) + COALESCE(pay.pending_cents, 0)), 0) AS due_cents,
						'PEN' AS currency
					FROM reservations r
					JOIN graves g ON g.id = r.grave_id
					LEFT JOIN locations l ON l.id = g.location_id
					LEFT JOIN sectors s ON s.id = l.sector_id
					LEFT JOIN LATERAL (
						SELECT (d.last_name || ' ' || d.first_name) AS deceased_full_name
						FROM burials b
						JOIN deceased d ON d.id = b.deceased_id
						WHERE b.grave_id = g.id
						ORDER BY b.id DESC
						LIMIT 1
					) occ ON true
					LEFT JOIN (
						SELECT
							p.reservation_id,
							SUM(p.amount_cents) FILTER (WHERE p.status = 'paid') AS paid_cents,
							SUM(p.amount_cents) FILTER (WHERE p.status = 'pending') AS pending_cents
						FROM payments p
						WHERE p.client_id = $1
						GROUP BY p.reservation_id
					) pay ON pay.reservation_id = r.id
					WHERE r.client_id = $1 AND r.reservation_code = $2
					LIMIT 1
				`
				: `
					SELECT
						r.id,
						r.reservation_code,
						r.status AS reservation_status,
						r.reserved_from,
						r.reserved_to,
						g.id AS grave_id,
						g.code AS grave_code,
						g.price_cents,
						s.name AS sector_name,
						l.row_number,
						l.col_number,
						occ.deceased_full_name,
						COALESCE(pay.paid_cents, 0) AS paid_cents,
						COALESCE(pay.pending_cents, 0) AS pending_cents,
						GREATEST(COALESCE(g.price_cents, 0) - (COALESCE(pay.paid_cents, 0) + COALESCE(pay.pending_cents, 0)), 0) AS due_cents,
						'PEN' AS currency
					FROM reservations r
					JOIN graves g ON g.id = r.grave_id
					LEFT JOIN locations l ON l.id = g.location_id
					LEFT JOIN sectors s ON s.id = l.sector_id
					LEFT JOIN LATERAL (
						SELECT (d.last_name || ' ' || d.first_name) AS deceased_full_name
						FROM burials b
						JOIN deceased d ON d.id = b.deceased_id
						WHERE b.grave_id = g.id
						ORDER BY b.id DESC
						LIMIT 1
					) occ ON true
					LEFT JOIN (
						SELECT
							p.reservation_id,
							SUM(p.amount_cents) FILTER (WHERE p.status = 'paid') AS paid_cents,
							SUM(p.amount_cents) FILTER (WHERE p.status = 'pending') AS pending_cents
						FROM payments p
						WHERE p.client_id = $1
						GROUP BY p.reservation_id
					) pay ON pay.reservation_id = r.id
					WHERE r.client_id = $1 AND r.reservation_code = $2
					LIMIT 1
				`,
			[clientId, reservationCode],
		);

		const row = result.rows[0];
		if (!row) return res.status(404).json({ ok: false, error: 'RESERVATION_NOT_FOUND' });
		return res.status(200).json({ ok: true, summary: row });
	});

	// Cliente/Visitante: ver sus reservas (si corresponde)
	router.get('/client/reservations', requireAuth, async (req, res) => {
		const userId = req.session.user.id;
		const clientId = await getClientIdOrNull(userId);
		if (!clientId) {
			return res.status(200).json({ ok: true, reservations: [] });
		}

		const hasReservedName = await reservationsHasReservedDeceasedNameColumn();
		const result = await db.query(
			hasReservedName
				? `
					SELECT
						r.id,
						r.reservation_code,
						r.grave_id,
						g.code AS grave_code,
						g.status AS grave_status,
						g.price_cents,
						s.name AS sector_name,
						l.row_number,
						l.col_number,
						l.latitude,
						l.longitude,
						COALESCE(r.reserved_deceased_full_name, occ.deceased_full_name) AS deceased_full_name,
						COALESCE(pay.paid_cents, 0) AS paid_cents,
						COALESCE(pay.pending_cents, 0) AS pending_cents,
						GREATEST(COALESCE(g.price_cents, 0) - (COALESCE(pay.paid_cents, 0) + COALESCE(pay.pending_cents, 0)), 0) AS due_cents,
						r.reserved_from,
						r.reserved_to,
						r.status,
						r.created_at
					FROM reservations r
					JOIN graves g ON g.id = r.grave_id
					LEFT JOIN locations l ON l.id = g.location_id
					LEFT JOIN sectors s ON s.id = l.sector_id
					LEFT JOIN LATERAL (
						SELECT (d.last_name || ' ' || d.first_name) AS deceased_full_name
						FROM burials b
						JOIN deceased d ON d.id = b.deceased_id
						WHERE b.grave_id = g.id
						ORDER BY b.id DESC
						LIMIT 1
					) occ ON true
					LEFT JOIN (
						SELECT
							p.reservation_id,
							SUM(p.amount_cents) FILTER (WHERE p.status = 'paid') AS paid_cents,
							SUM(p.amount_cents) FILTER (WHERE p.status = 'pending') AS pending_cents
						FROM payments p
						WHERE p.client_id = $1
						GROUP BY p.reservation_id
					) pay ON pay.reservation_id = r.id
					WHERE r.client_id = $1
					ORDER BY r.id DESC
					LIMIT 200
				`
				: `
					SELECT
						r.id,
						r.reservation_code,
						r.grave_id,
						g.code AS grave_code,
						g.status AS grave_status,
						g.price_cents,
						s.name AS sector_name,
						l.row_number,
						l.col_number,
						l.latitude,
						l.longitude,
						occ.deceased_full_name,
						COALESCE(pay.paid_cents, 0) AS paid_cents,
						COALESCE(pay.pending_cents, 0) AS pending_cents,
						GREATEST(COALESCE(g.price_cents, 0) - (COALESCE(pay.paid_cents, 0) + COALESCE(pay.pending_cents, 0)), 0) AS due_cents,
						r.reserved_from,
						r.reserved_to,
						r.status,
						r.created_at
					FROM reservations r
					JOIN graves g ON g.id = r.grave_id
					LEFT JOIN locations l ON l.id = g.location_id
					LEFT JOIN sectors s ON s.id = l.sector_id
					LEFT JOIN LATERAL (
						SELECT (d.last_name || ' ' || d.first_name) AS deceased_full_name
						FROM burials b
						JOIN deceased d ON d.id = b.deceased_id
						WHERE b.grave_id = g.id
						ORDER BY b.id DESC
						LIMIT 1
					) occ ON true
					LEFT JOIN (
						SELECT
							p.reservation_id,
							SUM(p.amount_cents) FILTER (WHERE p.status = 'paid') AS paid_cents,
							SUM(p.amount_cents) FILTER (WHERE p.status = 'pending') AS pending_cents
						FROM payments p
						WHERE p.client_id = $1
						GROUP BY p.reservation_id
					) pay ON pay.reservation_id = r.id
					WHERE r.client_id = $1
					ORDER BY r.id DESC
					LIMIT 200
				`,
			[clientId],
		);

		return res.status(200).json({ ok: true, reservations: result.rows });
	});

	// Cliente/Visitante: ver sus pagos (si corresponde)
	router.get('/client/payments', requireAuth, async (req, res) => {
		const userId = req.session.user.id;
		const clientId = await getClientIdOrNull(userId);
		if (!clientId) {
			return res.status(200).json({ ok: true, payments: [] });
		}

		const result = await db.query(
			`
				SELECT
					p.id,
					p.reservation_id,
					r.reservation_code,
					r.grave_id,
					g.code AS grave_code,
					p.payment_type_id,
					pt.name AS payment_type_name,
					p.amount_cents,
					p.currency,
					p.status,
					p.paid_at,
					p.created_at
				FROM payments p
				JOIN payment_types pt ON pt.id = p.payment_type_id
				LEFT JOIN reservations r ON r.id = p.reservation_id
				LEFT JOIN graves g ON g.id = r.grave_id
				WHERE p.client_id = $1
				ORDER BY p.id DESC
				LIMIT 200
			`,
			[clientId],
		);

		return res.status(200).json({ ok: true, payments: result.rows });
	});

	// Cliente: registrar un pago (queda pending para validación)
	router.post('/client/payments', requireAuth, async (req, res) => {
		const userId = req.session.user.id;
		const clientId = await getClientIdOrNull(userId);
		if (!clientId) return res.status(403).json({ ok: false, error: 'CLIENT_REQUIRED' });

		const reservationCode = normalizeQuery(req.body?.reservationCode);
		const paymentTypeId = req.body?.paymentTypeId;
		const amountCents = Number(req.body?.amountCents);
		const currency = normalizeQuery(req.body?.currency) || 'PEN';
		if (!reservationCode) return res.status(400).json({ ok: false, error: 'RESERVATION_CODE_REQUIRED' });
		if (!paymentTypeId) return res.status(400).json({ ok: false, error: 'PAYMENT_TYPE_REQUIRED' });
		if (!Number.isFinite(amountCents) || amountCents <= 0) return res.status(400).json({ ok: false, error: 'AMOUNT_INVALID' });

		try {
			const created = await db.withTransaction(async (client) => {
				const resv = await client.query(
				`
					SELECT r.id, r.status, r.grave_id, COALESCE(g.price_cents, 0) AS price_cents
					FROM reservations r
					JOIN graves g ON g.id = r.grave_id
					WHERE r.client_id = $1 AND r.reservation_code = $2
					LIMIT 1
					FOR UPDATE
				`,
				[clientId, reservationCode],
				);
				const reservation = resv.rows[0];
			if (!reservation) {
				const err = new Error('RESERVATION_NOT_FOUND');
				err.code = 'RESERVATION_NOT_FOUND';
				throw err;
			}
			if (reservation.status !== 'confirmed') {
				const err = new Error('RESERVATION_NOT_CONFIRMED');
				err.code = 'RESERVATION_NOT_CONFIRMED';
				throw err;
			}

			const sumsResult = await client.query(
				`
					SELECT
						COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0) AS paid_cents,
						COALESCE(SUM(amount_cents) FILTER (WHERE status = 'pending'), 0) AS pending_cents
					FROM payments
					WHERE client_id = $1 AND reservation_id = $2
				`,
				[clientId, reservation.id],
			);
			const paidCents = Number(sumsResult.rows[0]?.paid_cents || 0);
			const pendingCents = Number(sumsResult.rows[0]?.pending_cents || 0);
			const priceCents = Number(reservation.price_cents || 0);
			const dueCents = Math.max(priceCents - (paidCents + pendingCents), 0);
			if (!(dueCents > 0)) {
				const err = new Error('NOTHING_DUE');
				err.code = 'NOTHING_DUE';
				throw err;
			}
			if (amountCents !== dueCents) {
				const err = new Error('AMOUNT_MUST_MATCH_DUE');
				err.code = 'AMOUNT_MUST_MATCH_DUE';
				throw err;
			}

			const inserted = await client.query(
				`INSERT INTO payments (client_id, reservation_id, payment_type_id, amount_cents, currency, status)
				 VALUES ($1, $2, $3, $4, $5, 'pending')
				 RETURNING id, client_id, reservation_id, payment_type_id, amount_cents, currency, status, paid_at, created_at`,
				[clientId, reservation.id, paymentTypeId, amountCents, currency],
			);
			return inserted.rows[0];
			});

			return res.status(200).json({ ok: true, payment: created });
		} catch (error) {
			const code = error?.code || error?.message;
			if (code === 'RESERVATION_NOT_FOUND') return res.status(404).json({ ok: false, error: code });
			if (code === 'RESERVATION_NOT_CONFIRMED') return res.status(409).json({ ok: false, error: code });
			if (code === 'NOTHING_DUE') return res.status(409).json({ ok: false, error: code });
			if (code === 'AMOUNT_MUST_MATCH_DUE') return res.status(400).json({ ok: false, error: code });
			console.error('PAYMENT_CREATE_FAILED', error);
			return res.status(500).json({ ok: false, error: 'PAYMENT_CREATE_FAILED' });
		}
	});

	// Admin/Empleado: sectores y tumbas (permiso: graves)
	router.get('/admin/sectors', requireRole(['admin', 'employee']), requirePermission('graves'), async (req, res) => {
		const result = await db.query('SELECT id, name FROM sectors ORDER BY name ASC');
		return res.status(200).json({ ok: true, sectors: result.rows });
	});

	// Admin/Empleado: mapa de tumbas por sector (permiso: graves)
	router.get('/admin/grave-map', requireRole(['admin', 'employee']), requirePermission('graves'), async (req, res) => {
		const requestedSectorId = toOptionalBigInt(req.query?.sectorId);
		const sectorsResult = await db.query('SELECT id, name FROM sectors ORDER BY name ASC');
		const sectors = sectorsResult.rows;
		if (sectors.length === 0) return res.status(200).json({ ok: true, sectors: [], sectorId: null, graves: [] });

		const sectorId = requestedSectorId ?? sectors[0].id;
		const gravesResult = await db.query(
			`
				SELECT
					g.id,
					g.code,
					g.status AS grave_status,
					g.price_cents,
					g.is_enabled,
					g.grave_type_id,
					gt.name AS grave_type_name,
					l.sector_id,
					s.name AS sector_name,
					l.row_number,
					l.col_number,
					ar.id AS active_reservation_id,
					ar.status AS active_reservation_status,
					ar.reservation_code AS active_reservation_code,
					ar.client_id AS active_reservation_client_id,
					(occ.burial_id IS NOT NULL) AS has_burial
				FROM graves g
				LEFT JOIN grave_types gt ON gt.id = g.grave_type_id
				LEFT JOIN locations l ON l.id = g.location_id
				LEFT JOIN sectors s ON s.id = l.sector_id
				LEFT JOIN LATERAL (
					SELECT r.id, r.client_id, r.status, r.reservation_code
					FROM reservations r
					WHERE r.grave_id = g.id
						AND r.status IN ('pending','confirmed')
					ORDER BY r.id DESC
					LIMIT 1
				) ar ON true
				LEFT JOIN LATERAL (
					SELECT b.id AS burial_id
					FROM burials b
					WHERE b.grave_id = g.id
					ORDER BY b.id DESC
					LIMIT 1
				) occ ON true
				WHERE l.sector_id = $1
				ORDER BY l.row_number ASC NULLS LAST, l.col_number ASC NULLS LAST, g.id ASC
			`,
			[sectorId],
		);

		return res.status(200).json({ ok: true, sectors, sectorId, graves: gravesResult.rows });
	});

	router.post('/admin/sectors', requireRole(['admin', 'employee']), requirePermission('graves'), async (req, res) => {
		const name = normalizeQuery(req.body?.name);
		if (!name) return res.status(400).json({ ok: false, error: 'NAME_REQUIRED' });

		const result = await db.query(
			'INSERT INTO sectors (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id, name',
			[name],
		);
		return res.status(200).json({ ok: true, sector: result.rows[0] });
	});

	// Admin/Empleado: generar/expandir grilla (permiso: graves)
	router.post('/admin/sectors/:sectorId/grid', requireRole(['admin', 'employee']), requirePermission('graves'), async (req, res) => {
		const sectorId = Number(req.params.sectorId);
		if (!Number.isFinite(sectorId)) return res.status(400).json({ ok: false, error: 'SECTOR_ID_INVALID' });

		const rows = Number(req.body?.rows);
		const cols = Number(req.body?.cols);
		if (!Number.isFinite(rows) || rows < 1 || rows > 200) return res.status(400).json({ ok: false, error: 'ROWS_INVALID' });
		if (!Number.isFinite(cols) || cols < 1 || cols > 200) return res.status(400).json({ ok: false, error: 'COLS_INVALID' });
		if (rows * cols > 5000) return res.status(400).json({ ok: false, error: 'GRID_TOO_LARGE' });

		const priceCents = req.body?.priceCents != null ? Number(req.body?.priceCents) : 0;
		if (!Number.isFinite(priceCents) || priceCents < 0) return res.status(400).json({ ok: false, error: 'PRICE_INVALID' });
		const graveTypeId = req.body?.graveTypeId != null ? Number(req.body?.graveTypeId) : null;
		const isEnabled = req.body?.isEnabled != null ? Boolean(req.body?.isEnabled) : true;
		const status = 'available';

		try {
			const created = await db.withTransaction(async (client) => {
				const sectorCheck = await client.query('SELECT id FROM sectors WHERE id = $1 LIMIT 1', [sectorId]);
				if (sectorCheck.rowCount === 0) {
					const err = new Error('SECTOR_NOT_FOUND');
					err.code = 'SECTOR_NOT_FOUND';
					throw err;
				}

				// 1) Asegura locations para todas las coordenadas 1..rows x 1..cols
				const locInsert = await client.query(
					`
						INSERT INTO locations (sector_id, row_number, col_number)
						SELECT $1, r, c
						FROM generate_series(1, $2) AS r
						CROSS JOIN generate_series(1, $3) AS c
						ON CONFLICT (sector_id, row_number, col_number) DO NOTHING
					`,
					[sectorId, rows, cols],
				);

				// 2) Inserta graves faltantes para esas locations (uno por location)
				await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['graves_code_seq']);
				const maxResult = await client.query(
					`SELECT COALESCE(MAX((regexp_replace(lower(code), '^t-', ''))::int), 0) AS max_n
					 FROM graves
					 WHERE lower(code) ~ '^t-[0-9]+$'`,
				);
				const base = Number(maxResult.rows[0]?.max_n || 0);

				const graveInsert = await client.query(
					`
						WITH slots AS (
							SELECT l.id AS location_id
							FROM locations l
							LEFT JOIN graves g ON g.location_id = l.id
							WHERE l.sector_id = $1
								AND l.row_number BETWEEN 1 AND $2
								AND l.col_number BETWEEN 1 AND $3
								AND g.id IS NULL
							ORDER BY l.row_number ASC, l.col_number ASC, l.id ASC
						)
						INSERT INTO graves (code, status, price_cents, is_enabled, notes, location_id, grave_type_id)
						SELECT
							('t-' || lpad(($4 + row_number() OVER (ORDER BY location_id))::text, 4, '0')) AS code,
							$5 AS status,
							$6 AS price_cents,
							$7 AS is_enabled,
							NULL AS notes,
							location_id,
							$8 AS grave_type_id
						FROM slots
						RETURNING id, code, location_id
					`,
					[sectorId, rows, cols, base, status, priceCents, isEnabled, graveTypeId],
				);

				return {
					createdLocations: locInsert.rowCount,
					createdGraves: graveInsert.rowCount,
					createdCodes: graveInsert.rows.slice(0, 10).map((r) => r.code),
				};
			});

			return res.status(200).json({ ok: true, ...created });
		} catch (e) {
			const code = e?.code || e?.message;
			if (code === 'SECTOR_NOT_FOUND') return res.status(404).json({ ok: false, error: code });
			console.error('GRID_GENERATE_FAILED', e);
			return res.status(500).json({ ok: false, error: 'GRID_GENERATE_FAILED' });
		}
	});

	router.get('/admin/grave-types', requireRole(['admin', 'employee']), requirePermission('graves'), async (req, res) => {
		const result = await db.query('SELECT id, name FROM grave_types ORDER BY name ASC');
		return res.status(200).json({ ok: true, graveTypes: result.rows });
	});

	router.get('/admin/graves', requireRole(['admin', 'employee']), requirePermission('graves'), async (req, res) => {
		const result = await db.query(
			`
				SELECT
					g.id,
					g.code,
					g.status,
					g.price_cents,
					g.is_enabled,
					g.notes,
					g.location_id,
					g.grave_type_id,
					gt.name AS grave_type_name,
					l.sector_id,
					s.name AS sector_name,
					l.row_number,
					l.col_number,
					l.latitude,
					l.longitude,
					g.created_at,
					g.updated_at
				FROM graves g
				LEFT JOIN grave_types gt ON gt.id = g.grave_type_id
				LEFT JOIN locations l ON l.id = g.location_id
				LEFT JOIN sectors s ON s.id = l.sector_id
				ORDER BY g.id DESC
				LIMIT 200
			`,
		);
		return res.status(200).json({ ok: true, graves: result.rows });
	});

	router.post('/admin/graves', requireRole(['admin', 'employee']), requirePermission('graves'), async (req, res) => {
		const codeInput = normalizeQuery(req.body?.code);
		const sectorId = req.body?.sectorId ?? null;
		const rowNumber = req.body?.rowNumber ?? null;
		const colNumber = req.body?.colNumber ?? null;
		const latitude = req.body?.latitude ?? null;
		const longitude = req.body?.longitude ?? null;
		const graveTypeId = req.body?.graveTypeId ?? null;
		const status = normalizeQuery(req.body?.status) || 'available';
		const priceCents = Number(req.body?.priceCents ?? 0);
		const isEnabled = req.body?.isEnabled != null ? Boolean(req.body?.isEnabled) : true;
		const notes = normalizeQuery(req.body?.notes) || null;
		if (!['available', 'occupied', 'reserved', 'maintenance'].includes(status)) {
			return res.status(400).json({ ok: false, error: 'STATUS_INVALID' });
		}
		if (!Number.isFinite(priceCents) || priceCents < 0) {
			return res.status(400).json({ ok: false, error: 'PRICE_INVALID' });
		}

		function formatGraveCode(n) {
			const padded = String(n).padStart(4, '0');
			return `t-${padded}`;
		}

		let locationId = null;
		if (sectorId != null || rowNumber != null || colNumber != null || latitude != null || longitude != null) {
			const locationResult = await db.query(
				`
					INSERT INTO locations (sector_id, row_number, col_number, latitude, longitude)
					VALUES ($1, $2, $3, $4, $5)
					ON CONFLICT (sector_id, row_number, col_number)
					DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
					RETURNING id
				`,
				[sectorId, rowNumber, colNumber, latitude, longitude],
			);
			locationId = locationResult.rows[0]?.id ?? null;
		}

		const result = await db.withTransaction(async (client) => {
			// Evita colisiones en generación secuencial
			await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['graves_code_seq']);

			let code = codeInput || null;
			if (!code) {
				const maxResult = await client.query(
					`SELECT COALESCE(MAX((regexp_replace(lower(code), '^t-', ''))::int), 0) AS max_n
					 FROM graves
					 WHERE lower(code) ~ '^t-[0-9]+$'`,
				);
				const next = Number(maxResult.rows[0]?.max_n || 0) + 1;
				code = formatGraveCode(next);
			}

			// Inserta y si choca (por código existente), reintenta sin abortar la transacción.
			for (let i = 0; i < 5; i++) {
				const inserted = await client.query(
					`
						INSERT INTO graves (code, status, price_cents, is_enabled, notes, location_id, grave_type_id)
						VALUES ($1, $2, $3, $4, $5, $6, $7)
						ON CONFLICT DO NOTHING
						RETURNING id, code, status, price_cents, is_enabled, notes, location_id, grave_type_id
					`,
					[code, status, priceCents, isEnabled, notes, locationId, graveTypeId],
				);
				if (inserted.rowCount > 0) return inserted;

				if (codeInput) break;
				const maxResult = await client.query(
					`SELECT COALESCE(MAX((regexp_replace(lower(code), '^t-', ''))::int), 0) AS max_n
					 FROM graves
					 WHERE lower(code) ~ '^t-[0-9]+$'`,
				);
				const next = Number(maxResult.rows[0]?.max_n || 0) + 1;
				code = formatGraveCode(next);
			}

			const err = new Error('GRAVE_CODE_GENERATION_FAILED');
			err.code = 'GRAVE_CODE_GENERATION_FAILED';
			throw err;
		});

		return res.status(200).json({ ok: true, grave: result.rows[0] });
	});

	router.patch('/admin/graves/:id', requireRole(['admin', 'employee']), requirePermission('graves'), async (req, res) => {
		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'ID_INVALID' });

		const sectorId = req.body?.sectorId ?? null;
		const rowNumber = req.body?.rowNumber ?? null;
		const colNumber = req.body?.colNumber ?? null;
		const latitude = req.body?.latitude ?? null;
		const longitude = req.body?.longitude ?? null;
		const graveTypeId = req.body?.graveTypeId ?? null;
		const status = req.body?.status != null ? normalizeQuery(req.body?.status) : null;
		const priceCents = req.body?.priceCents != null ? Number(req.body?.priceCents) : null;
		const isEnabled = req.body?.isEnabled != null ? Boolean(req.body?.isEnabled) : null;
		const notes = req.body?.notes != null ? normalizeQuery(req.body?.notes) : null;

		if (status != null && !['available', 'occupied', 'reserved', 'maintenance'].includes(status)) {
			return res.status(400).json({ ok: false, error: 'STATUS_INVALID' });
		}
		if (priceCents != null && (!Number.isFinite(priceCents) || priceCents < 0)) {
			return res.status(400).json({ ok: false, error: 'PRICE_INVALID' });
		}

		const updated = await db.withTransaction(async (client) => {
			const currentResult = await client.query('SELECT id, status, location_id FROM graves WHERE id = $1 FOR UPDATE', [
				id,
			]);
			const current = currentResult.rows[0];
			if (!current) return null;

			let locationId = current.location_id;
			if (sectorId != null || rowNumber != null || colNumber != null || latitude != null || longitude != null) {
				const locationResult = await client.query(
					`
						INSERT INTO locations (sector_id, row_number, col_number, latitude, longitude)
						VALUES ($1, $2, $3, $4, $5)
						ON CONFLICT (sector_id, row_number, col_number)
						DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
						RETURNING id
					`,
					[sectorId, rowNumber, colNumber, latitude, longitude],
				);
				locationId = locationResult.rows[0]?.id ?? locationId;
			}

			const newStatus = status != null ? status : current.status;
			const updateResult = await client.query(
				`
					UPDATE graves
					SET status = COALESCE($1, status),
						price_cents = COALESCE($2, price_cents),
						is_enabled = COALESCE($3, is_enabled),
						notes = COALESCE($4, notes),
						location_id = $5,
						grave_type_id = COALESCE($6, grave_type_id),
						updated_at = now()
					WHERE id = $7
					RETURNING id, code, status, price_cents, is_enabled, notes, location_id, grave_type_id
				`,
				[status, priceCents, isEnabled, notes, locationId, graveTypeId, id],
			);

			if (status != null && current.status !== newStatus) {
				await client.query(
					`INSERT INTO grave_status_history (grave_id, old_status, new_status, changed_by_user_id)
					 VALUES ($1, $2, $3, $4)`,
					[id, current.status, newStatus, req.session.user.id],
				);
			}

			return updateResult.rows[0];
		});

		if (!updated) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
		return res.status(200).json({ ok: true, grave: updated });
	});

	// Admin/Empleado: registrar entierro (permiso: deceased)
	router.post('/employee/burials', requireRole(['admin', 'employee']), requirePermission('deceased'), async (req, res) => {
		const firstName = normalizeQuery(req.body?.firstName);
		const lastName = normalizeQuery(req.body?.lastName);
		const dateOfDeath = req.body?.dateOfDeath || null;
		const graveId = req.body?.graveId;
		const burialDate = req.body?.burialDate || null;

		if (!firstName || !lastName) {
			return res.status(400).json({ ok: false, error: 'NAME_REQUIRED' });
		}
		if (!graveId) return res.status(400).json({ ok: false, error: 'GRAVE_REQUIRED' });

		try {
			const created = await db.withTransaction(async (client) => {
				const deceasedResult = await client.query(
					`INSERT INTO deceased (first_name, last_name, date_of_death)
					 VALUES ($1, $2, $3)
					 RETURNING id, first_name, last_name, date_of_death`,
					[firstName, lastName, dateOfDeath],
				);
				const deceased = deceasedResult.rows[0];

				const burialResult = await client.query(
					`INSERT INTO burials (deceased_id, grave_id, burial_date)
					 VALUES ($1, $2, $3)
					 RETURNING id, deceased_id, grave_id, burial_date`,
					[deceased.id, graveId, burialDate],
				);

				const oldStatusResult = await client.query('SELECT status FROM graves WHERE id = $1', [graveId]);
				const oldStatus = oldStatusResult.rows[0]?.status;

				await client.query(`UPDATE graves SET status = 'occupied', updated_at = now() WHERE id = $1`, [graveId]);
				await client.query(
					`INSERT INTO grave_status_history (grave_id, old_status, new_status, changed_by_user_id)
					 VALUES ($1, $2, $3, $4)`,
					[graveId, oldStatus, 'occupied', req.session.user.id],
				);

				return { deceased, burial: burialResult.rows[0] };
			});

			return res.status(200).json({ ok: true, ...created });
		} catch (error) {
			return res.status(400).json({ ok: false, error: 'BURIAL_CREATE_FAILED' });
		}
	});

	return router;
}

module.exports = {
	buildCemeteryRouter,
};
