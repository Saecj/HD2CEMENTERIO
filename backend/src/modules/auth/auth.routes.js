const express = require('express');
const db = require('../../infrastructure/db');
const { createMailerFromEnv } = require('../../infrastructure/mailer');
const {
	generateOtpCode,
	hashOtp,
	normalizeEmail,
	validatePasswordStrength,
	hashPassword,
	verifyPassword,
} = require('./auth.service');

function buildAuthRouter() {
	const router = express.Router();

	async function sendOtpToEmail(email) {
		const code = generateOtpCode();
		const codeHash = hashOtp(process.env, email, code);
		const expiresMinutes = process.env.OTP_EXPIRES_MIN ? Number(process.env.OTP_EXPIRES_MIN) : 10;
		const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

		await db.query(
			'INSERT INTO auth_email_codes (email, code_hash, expires_at) VALUES ($1, $2, $3)',
			[email, codeHash, expiresAt],
		);

		const from = process.env.SMTP_FROM || 'no-reply@localhost';
		const subject = process.env.OTP_EMAIL_SUBJECT || 'Tu código de verificación';
		const appName = process.env.APP_NAME || 'Cementerio';
		const text = `Tu código de verificación para ${appName} es: ${code}.\n\nVence en ${expiresMinutes} minutos.`;

		const mailer = createMailerFromEnv(process.env);
		if (mailer) {
			await mailer.sendMail({ from, to: email, subject, text });
		} else {
			console.warn(`[auth] SMTP no configurado; código OTP para ${email}: ${code}`);
		}
	}

	async function loadUserSession(userId) {
		const result = await db.query(
			`SELECT u.id, u.email, u.username, u.role_id, r.name AS role,
					e.permissions AS employee_permissions
			 FROM users u
			 JOIN roles r ON r.id = u.role_id
			 LEFT JOIN employees e ON e.user_id = u.id
			 WHERE u.id = $1`,
			[userId],
		);
		const u = result.rows[0];
		if (!u) return null;
		const permissions = Array.isArray(u.employee_permissions) ? u.employee_permissions : [];
		return { id: u.id, email: u.email, username: u.username, roleId: u.role_id, role: u.role, permissions };
	}

	function truthy(value) {
		return value === true || value === 'true' || value === 1 || value === '1' || value === 'on';
	}

	function isEmailOk(value) {
		return typeof value === 'string' && /.+@.+\..+/.test(value);
	}

	router.post('/login', async (req, res) => {
		const email = normalizeEmail(req.body?.email);
		const password = String(req.body?.password || '');
		if (!email || !isEmailOk(email) || !password) {
			return res.status(400).json({ ok: false, error: 'INVALID_INPUT' });
		}

		const userResult = await db.query(
			`SELECT u.id, u.password_hash, u.email_verified_at
			 FROM users u
			 WHERE u.email = $1
			 LIMIT 1`,
			[email],
		);
		const user = userResult.rows[0];
		if (!user?.password_hash) {
			return res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
		}
		if (!user.email_verified_at) {
			return res.status(403).json({ ok: false, error: 'EMAIL_NOT_VERIFIED' });
		}

		const ok = await verifyPassword(password, user.password_hash);
		if (!ok) {
			return res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
		}

		const sessionUser = await loadUserSession(user.id);
		req.session.user = sessionUser;
		return res.status(200).json({ ok: true, user: req.session.user });
	});

	router.post('/request-code', async (req, res) => {
		const email = normalizeEmail(req.body?.email);
		if (!email || !isEmailOk(email)) {
			return res.status(400).json({ ok: false, error: 'EMAIL_INVALID' });
		}
		await sendOtpToEmail(email);

		return res.status(200).json({ ok: true });
	});

	router.post('/verify-code', async (req, res) => {
		const email = normalizeEmail(req.body?.email);
		const code = String(req.body?.code || '').trim();
		if (!email || !isEmailOk(email) || !code) {
			return res.status(400).json({ ok: false, error: 'INVALID_INPUT' });
		}

		const codeHash = hashOtp(process.env, email, code);
		const result = await db.query(
			`
				SELECT id
				FROM auth_email_codes
				WHERE email = $1
					AND code_hash = $2
					AND consumed_at IS NULL
					AND expires_at > now()
				ORDER BY created_at DESC
				LIMIT 1
			`,
			[email, codeHash],
		);

		if (result.rowCount === 0) {
			return res.status(401).json({ ok: false, error: 'CODE_INVALID_OR_EXPIRED' });
		}

		const codeId = result.rows[0].id;
		await db.query('UPDATE auth_email_codes SET consumed_at = now() WHERE id = $1', [codeId]);

		const rolesResult = await db.query(
			"SELECT id, name FROM roles WHERE name IN ('admin','employee','visitor','client')",
		);
		const rolesByName = new Map(rolesResult.rows.map((r) => [r.name, r.id]));
		const visitorRoleId = rolesByName.get('visitor');
		const adminRoleId = rolesByName.get('admin');
		if (!visitorRoleId || !adminRoleId) {
			return res.status(500).json({ ok: false, error: 'ROLES_NOT_INITIALIZED' });
		}

		const userUpsert = await db.query(
			`
				INSERT INTO users (email, role_id)
				VALUES ($1, $2)
				ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
				RETURNING id, email, role_id
			`,
			[email, visitorRoleId],
		);

		let user = userUpsert.rows[0];
		const bootstrapAdminEmail = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL);
		if (bootstrapAdminEmail && bootstrapAdminEmail === email) {
			if (user.role_id !== adminRoleId) {
				const updated = await db.query(
					'UPDATE users SET role_id = $1 WHERE id = $2 RETURNING id, email, role_id',
					[adminRoleId, user.id],
				);
				user = updated.rows[0] || user;
			}
		}

		const sessionUser = await loadUserSession(user.id);
		req.session.user = sessionUser || {
			id: user.id,
			email: user.email,
			username: null,
			roleId: user.role_id,
			role: 'visitor',
			permissions: [],
		};
		return res.status(200).json({ ok: true, user: req.session.user });
	});

	// Registro de cliente: NO crea usuario hasta verificar correo.
	router.post('/register', async (req, res) => {
		const username = String(req.body?.username || '').trim();
		const email = normalizeEmail(req.body?.email);
		const phone = String(req.body?.phone || '').trim() || null;
		const documentId = String(req.body?.documentId || '').trim() || null;
		const password = String(req.body?.password || '');
		const confirmPassword = String(req.body?.confirmPassword || '');
		const acceptTerms = truthy(req.body?.acceptTerms);
		if (!username) {
			return res.status(400).json({ ok: false, error: 'USERNAME_REQUIRED' });
		}
		if (username.length < 2 || username.length > 24) {
			return res.status(400).json({ ok: false, error: 'USERNAME_INVALID' });
		}
		if (!email || !isEmailOk(email)) {
			return res.status(400).json({ ok: false, error: 'EMAIL_INVALID' });
		}
		if (!documentId) {
			return res.status(400).json({ ok: false, error: 'DNI_REQUIRED' });
		}
		if (!/^\d{7}$/.test(documentId)) {
			return res.status(400).json({ ok: false, error: 'DNI_INVALID' });
		}
		if (phone && !/^\d{9}$/.test(phone)) {
			return res.status(400).json({ ok: false, error: 'PHONE_INVALID' });
		}
		if (!acceptTerms) {
			return res.status(400).json({ ok: false, error: 'TERMS_REQUIRED' });
		}
		if (!password || password !== confirmPassword) {
			return res.status(400).json({ ok: false, error: 'PASSWORD_MISMATCH' });
		}
		const strength = validatePasswordStrength(password);
		if (!strength.ok) {
			return res.status(400).json({ ok: false, error: strength.reason || 'PASSWORD_WEAK' });
		}

		const existing = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
		if (existing.rowCount > 0) {
			return res.status(409).json({ ok: false, error: 'EMAIL_ALREADY_REGISTERED' });
		}

		const passwordHash = await hashPassword(password);
		const code = generateOtpCode();
		const codeHash = hashOtp(process.env, email, code);
		const expiresMinutes = process.env.OTP_EXPIRES_MIN ? Number(process.env.OTP_EXPIRES_MIN) : 10;
		const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

		await db.query(
			`INSERT INTO pending_client_registrations (email, username, password_hash, document_id, phone, code_hash, expires_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 ON CONFLICT (email) DO UPDATE
			 SET username = EXCLUDED.username,
			 	password_hash = EXCLUDED.password_hash,
			 	document_id = EXCLUDED.document_id,
			 	phone = EXCLUDED.phone,
			 	code_hash = EXCLUDED.code_hash,
			 	expires_at = EXCLUDED.expires_at`,
			[email, username, passwordHash, documentId, phone, codeHash, expiresAt],
		);

		const from = process.env.SMTP_FROM || 'no-reply@localhost';
		const subject = process.env.OTP_EMAIL_SUBJECT || 'Verifica tu correo';
		const appName = process.env.APP_NAME || 'Cementerio';
		const text = `Tu código de verificación para ${appName} es: ${code}.\n\nVence en ${expiresMinutes} minutos.`;
		const mailer = createMailerFromEnv(process.env);
		if (mailer) {
			await mailer.sendMail({ from, to: email, subject, text });
		} else {
			console.warn(`[auth] SMTP no configurado; código de verificación para ${email}: ${code}`);
		}

		return res.status(200).json({ ok: true, next: 'verify' });
	});

	router.post('/verify-email', async (req, res) => {
		const email = normalizeEmail(req.body?.email);
		const code = String(req.body?.code || '').trim();
		if (!email || !isEmailOk(email) || !code) {
			return res.status(400).json({ ok: false, error: 'INVALID_INPUT' });
		}

		const pending = await db.query(
			`SELECT email, username, password_hash, document_id, phone, code_hash, expires_at
			 FROM pending_client_registrations
			 WHERE email = $1`,
			[email],
		);
		const row = pending.rows[0];
		if (!row) return res.status(401).json({ ok: false, error: 'CODE_INVALID_OR_EXPIRED' });
		if (new Date(row.expires_at).getTime() <= Date.now()) {
			return res.status(401).json({ ok: false, error: 'CODE_INVALID_OR_EXPIRED' });
		}
		const codeHash = hashOtp(process.env, email, code);
		if (codeHash !== row.code_hash) {
			return res.status(401).json({ ok: false, error: 'CODE_INVALID_OR_EXPIRED' });
		}

		const rolesResult = await db.query("SELECT id, name FROM roles WHERE name IN ('client')");
		const clientRoleId = rolesResult.rows.find((r) => r.name === 'client')?.id;
		if (!clientRoleId) {
			return res.status(500).json({ ok: false, error: 'ROLES_NOT_INITIALIZED' });
		}

		const createdUserId = await db.withTransaction(async (client) => {
			const finalUsername = String(row.username || '').trim() || String(email).split('@')[0] || null;
			const existing = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
			if (existing.rowCount > 0) {
				const err = new Error('EMAIL_ALREADY_REGISTERED');
				err.code = 'EMAIL_ALREADY_REGISTERED';
				throw err;
			}

			const inserted = await client.query(
				`INSERT INTO users (email, username, role_id, password_hash, email_verified_at)
				 VALUES ($1, $2, $3, $4, now())
				 RETURNING id`,
				[email, finalUsername, clientRoleId, row.password_hash],
			);
			const userId = inserted.rows[0]?.id;
			if (!userId) throw new Error('REGISTER_FAILED');

			await client.query(
				`INSERT INTO clients (user_id, full_name, phone, document_id)
				 VALUES ($1, NULL, $2, $3)
				 ON CONFLICT (user_id) DO UPDATE
				 SET phone = EXCLUDED.phone,
				 	document_id = EXCLUDED.document_id`,
				[userId, row.phone, row.document_id],
			);

			await client.query('DELETE FROM pending_client_registrations WHERE email = $1', [email]);
			return userId;
		});

		const sessionUser = await loadUserSession(createdUserId);
		req.session.user = sessionUser;
		return res.status(200).json({ ok: true, user: req.session.user });
	});

	router.get('/me', (req, res) => {
		if (!req.session?.user) return res.status(200).json({ ok: true, user: null });
		return res.status(200).json({ ok: true, user: req.session.user });
	});

	router.post('/logout', (req, res) => {
		req.session.destroy(() => {
			res.clearCookie('sid');
			return res.status(200).json({ ok: true });
		});
	});

	return router;
}

module.exports = {
	buildAuthRouter,
};
