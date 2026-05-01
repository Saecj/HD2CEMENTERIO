const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(crypto.scrypt);

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

function generateOtpCode() {
	return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(env, email, code) {
	const secret = env.OTP_SECRET || env.SESSION_SECRET || 'dev-secret';
	return crypto
		.createHmac('sha256', secret)
		.update(`${normalizeEmail(email)}:${String(code).trim()}`)
		.digest('hex');
}

function validatePasswordStrength(password) {
	const value = String(password || '');
	if (value.length < 8) return { ok: false, reason: 'PASSWORD_TOO_SHORT' };
	if (!/[A-Z]/.test(value)) return { ok: false, reason: 'PASSWORD_MISSING_UPPERCASE' };
	if (!/[0-9]/.test(value)) return { ok: false, reason: 'PASSWORD_MISSING_NUMBER' };
	if (!/[^A-Za-z0-9]/.test(value)) return { ok: false, reason: 'PASSWORD_MISSING_SPECIAL' };
	return { ok: true };
}

async function hashPassword(password) {
	const salt = crypto.randomBytes(16);
	const derivedKey = await scryptAsync(String(password), salt, 64, {
		N: 16384,
		r: 8,
		p: 1,
		maxmem: 64 * 1024 * 1024,
	});
	return `scrypt:16384:8:1:${salt.toString('base64')}:${Buffer.from(derivedKey).toString('base64')}`;
}

async function verifyPassword(password, passwordHash) {
	const raw = String(passwordHash || '');
	const parts = raw.split(':');
	if (parts.length !== 6) return false;
	const [algo, nStr, rStr, pStr, saltB64, hashB64] = parts;
	if (algo !== 'scrypt') return false;
	const N = Number(nStr);
	const r = Number(rStr);
	const p = Number(pStr);
	if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

	const salt = Buffer.from(saltB64, 'base64');
	const expected = Buffer.from(hashB64, 'base64');
	if (!salt.length || !expected.length) return false;

	const derivedKey = await scryptAsync(String(password), salt, expected.length, {
		N,
		r,
		p,
		maxmem: 64 * 1024 * 1024,
	});
	return crypto.timingSafeEqual(Buffer.from(derivedKey), expected);
}

module.exports = {
	normalizeEmail,
	generateOtpCode,
	hashOtp,
	validatePasswordStrength,
	hashPassword,
	verifyPassword,
};
