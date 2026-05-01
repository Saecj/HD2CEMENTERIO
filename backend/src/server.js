const { createApp } = require('./app');
const { ensureBootstrapAdmin } = require('./bootstrap/admin');

function start() {
	const app = createApp();
	const port = Number(process.env.PORT) || 3001;
	app.listen(port, () => {
		console.log(`Backend escuchando en http://localhost:${port}`);
	});

	// Best-effort: prepara admin inicial si se configuró en env.
	ensureBootstrapAdmin();
}

module.exports = {
	start,
};
