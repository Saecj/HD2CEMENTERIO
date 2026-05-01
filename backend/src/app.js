const express = require('express');
const cors = require('cors');
const session = require('express-session');
const PgSessionStore = require('connect-pg-simple')(session);

const db = require('./infrastructure/db');
const { buildAuthRouter } = require('./modules/auth/auth.routes');
const { buildAdminRouter } = require('./modules/admin/admin.routes');
const { buildCemeteryRouter } = require('./modules/cemetery/cemetery.routes');

function createApp() {
	const app = express();

	const appOrigin = process.env.APP_ORIGIN || 'http://localhost:5173';
	app.set('trust proxy', 1);

	app.use(
		cors({
			origin: appOrigin,
			credentials: true,
		}),
	);
	app.use(express.json());

	const sessionSecret = process.env.SESSION_SECRET || 'dev-session-secret-change-me';
	if (!process.env.SESSION_SECRET) {
		console.warn('[auth] SESSION_SECRET no definido; usando valor dev (no usar en producción)');
	}

	app.use(
		session({
			name: 'sid',
			secret: sessionSecret,
			resave: false,
			saveUninitialized: false,
			store: new PgSessionStore({
				pool: db.getPool(),
				createTableIfMissing: true,
			}),
			cookie: {
				httpOnly: true,
				sameSite: 'lax',
				secure: process.env.NODE_ENV === 'production',
				maxAge: 1000 * 60 * 60 * 24 * 7,
			},
		}),
	);

	app.get('/health', (req, res) => {
		res.status(200).json({ ok: true });
	});
	app.get('/api/health', (req, res) => {
		res.status(200).json({ ok: true });
	});
	app.get('/api/health/db', async (req, res) => {
		try {
			await db.query('SELECT 1 AS ok');
			res.status(200).json({ ok: true });
		} catch {
			res.status(503).json({ ok: false });
		}
	});

	app.use('/api/auth', buildAuthRouter());
	app.use('/api/admin', buildAdminRouter());
	app.use('/api', buildCemeteryRouter());

	function collectInnerErrors(err) {
		if (!err) return [];
		if (err instanceof AggregateError && Array.isArray(err.errors)) return err.errors;
		return [];
	}

	function isDbConnectionError(err) {
		const candidates = [err, ...collectInnerErrors(err)];
		return candidates.some((e) => {
			const code = e?.code;
			if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') return true;
			const msg = String(e?.message || '');
			return msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT');
		});
	}

	app.use((err, req, res, next) => {
		if (res.headersSent) return next(err);
		if (isDbConnectionError(err)) {
			console.error('[db] No se pudo conectar a Postgres:', err?.message || err);
			return res.status(503).json({ ok: false, error: 'DB_UNAVAILABLE' });
		}
		if (err?.code === '42P01') {
			// undefined_table (migraciones no ejecutadas)
			console.error('[db] Esquema no listo (migraciones faltantes):', err?.message || err);
			return res.status(500).json({ ok: false, error: 'DB_SCHEMA_NOT_READY' });
		}
		console.error('[server] Error no manejado:', err);
		return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
	});

	return app;
}

module.exports = {
	createApp,
};
