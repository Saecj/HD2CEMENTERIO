const { Pool } = require('pg');

function parseBoolean(value) {
	if (value == null) return undefined;
	return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function buildPoolConfigFromEnv(env) {
	const databaseUrl = env.DATABASE_URL;
	if (databaseUrl) {
		return {
			connectionString: databaseUrl,
			ssl: parseBoolean(env.PGSSL)
				? { rejectUnauthorized: parseBoolean(env.PGSSL_REJECT_UNAUTHORIZED) ?? true }
				: undefined,
		};
	}

	return {
		host: env.PGHOST,
		port: env.PGPORT ? Number(env.PGPORT) : undefined,
		user: env.PGUSER,
		password: env.PGPASSWORD,
		database: env.PGDATABASE,
		ssl: parseBoolean(env.PGSSL)
			? { rejectUnauthorized: parseBoolean(env.PGSSL_REJECT_UNAUTHORIZED) ?? true }
			: undefined,
	};
}

let pool;

function getPool() {
	if (!pool) {
		pool = new Pool(buildPoolConfigFromEnv(process.env));
		// Loggea errores del pool (p.ej. desconexiones) para diagnóstico sin tumbar el proceso.
		pool.on('error', (err) => {
			console.error('[db] Pool error:', err?.message || err);
		});
	}
	return pool;
}

async function query(text, params) {
	return getPool().query(text, params);
}

async function withTransaction(fn) {
	const client = await getPool().connect();
	try {
		await client.query('BEGIN');
		const result = await fn(client);
		await client.query('COMMIT');
		return result;
	} catch (error) {
		try {
			await client.query('ROLLBACK');
		} catch {
			// ignore rollback errors
		}
		throw error;
	} finally {
		client.release();
	}
}

module.exports = {
	getPool,
	query,
	withTransaction,
};
