const crypto = require('node:crypto');

const db = require('../infrastructure/db');
const { normalizeEmail, hashPassword, validatePasswordStrength } = require('../modules/auth/auth.service');

function generateStrongPassword() {
	// Garantiza: >=8, mayúscula, número, símbolo.
	return `A${crypto.randomBytes(8).toString('hex')}!9`;
}

async function ensureBootstrapAdmin() {
	const email = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL);
	if (!email) return;

	let password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '').trim();
	const passwordProvided = Boolean(password);
	if (!passwordProvided) {
		password = generateStrongPassword();
	}

	const strength = validatePasswordStrength(password);
	if (!strength.ok) {
		console.warn(
			`[bootstrap] BOOTSTRAP_ADMIN_PASSWORD no cumple política (${strength.reason}). No se creó/actualizó el admin.`,
		);
		return;
	}

	try {
		await db.withTransaction(async (client) => {
			const roles = await client.query("SELECT id, name FROM roles WHERE name IN ('admin')");
			const adminRoleId = roles.rows.find((r) => r.name === 'admin')?.id;
			if (!adminRoleId) {
				console.warn('[bootstrap] Rol admin no existe (migra la BD).');
				return;
			}

			const existing = await client.query(
				`SELECT id, role_id, password_hash, email_verified_at
				 FROM users
				 WHERE email = $1
				 FOR UPDATE`,
				[email],
			);

			const passwordHash = await hashPassword(password);

			if (existing.rowCount === 0) {
				const inserted = await client.query(
					`INSERT INTO users (email, role_id, password_hash, email_verified_at)
					 VALUES ($1, $2, $3, now())
					 RETURNING id`,
					[email, adminRoleId, passwordHash],
				);
				const userId = inserted.rows[0]?.id;
				if (!userId) throw new Error('BOOTSTRAP_ADMIN_CREATE_FAILED');

				if (!passwordProvided) {
					console.warn(`[bootstrap] Admin creado: ${email}`);
					console.warn(`[bootstrap] Password generado (guárdalo): ${password}`);
				} else {
					console.warn(`[bootstrap] Admin creado: ${email}`);
				}
				return;
			}

			const u = existing.rows[0];
			// No pisamos password existente a menos que el usuario NO tenga password_hash (caso legacy).
			const shouldSetPassword = !u.password_hash;
			const shouldPromoteRole = u.role_id !== adminRoleId;
			const shouldVerify = !u.email_verified_at;

			if (!shouldSetPassword && !shouldPromoteRole && !shouldVerify) return;

			await client.query(
				`UPDATE users
				 SET role_id = $1,
				 	password_hash = CASE WHEN password_hash IS NULL THEN $2 ELSE password_hash END,
				 	email_verified_at = CASE WHEN email_verified_at IS NULL THEN now() ELSE email_verified_at END
				 WHERE id = $3`,
				[adminRoleId, passwordHash, u.id],
			);

			console.warn(`[bootstrap] Admin actualizado: ${email}`);
			if (shouldSetPassword && !passwordProvided) {
				console.warn(`[bootstrap] Password generado (guárdalo): ${password}`);
			}
		});
	} catch (err) {
		console.warn('[bootstrap] Falló ensureBootstrapAdmin:', err?.message || err);
	}
}

module.exports = {
	ensureBootstrapAdmin,
};
