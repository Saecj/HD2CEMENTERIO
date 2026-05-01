require('./src/config/env');

const { start } = require('./src/server');

// Evita que rechazos no manejados (p.ej. Postgres caído durante init) tumben el proceso sin log.
process.on('unhandledRejection', (reason) => {
	console.error('[process] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
	console.error('[process] Uncaught Exception:', err);
	// Mantén el comportamiento seguro: salimos para no quedar en un estado inconsistente.
	process.exitCode = 1;
});

start();
