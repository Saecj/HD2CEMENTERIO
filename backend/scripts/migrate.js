const fs = require('node:fs');
const path = require('node:path');
require('../src/config/env');
const db = require('../db');

async function ensureMigrationsTable() {
	await db.query(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		);
	`);
}

async function isApplied(id) {
	const result = await db.query('SELECT 1 FROM schema_migrations WHERE id = $1', [id]);
	return result.rowCount > 0;
}

async function markApplied(id) {
	await db.query('INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [id]);
}

function listSqlFiles() {
	const dir = path.join(__dirname, '..', 'sql');
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir)
		.filter((file) => file.endsWith('.sql'))
		.sort((a, b) => a.localeCompare(b, 'en'))
		.map((file) => ({
			id: file,
			filePath: path.join(dir, file),
		}));
}

async function run() {
	await ensureMigrationsTable();

	const files = listSqlFiles();
	if (files.length === 0) {
		console.log('No hay migraciones en backend/sql');
		return;
	}

	for (const { id, filePath } of files) {
		if (await isApplied(id)) {
			console.log(`✓ ${id} (ya aplicada)`);
			continue;
		}

		const sql = fs.readFileSync(filePath, 'utf8');
		console.log(`→ Aplicando ${id}...`);
		await db.query(sql);
		await markApplied(id);
		console.log(`✓ ${id} (ok)`);
	}
}

run().catch((error) => {
	console.error('Migración fallida:', error);
	process.exitCode = 1;
});
