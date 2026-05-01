const nodemailer = require('nodemailer');

function createMailerFromEnv(env) {
	const host = env.SMTP_HOST;
	const port = env.SMTP_PORT ? Number(env.SMTP_PORT) : undefined;
	const user = env.SMTP_USER;
	const pass = env.SMTP_PASS;
	if (!host || !port || !user || !pass) return null;

	return nodemailer.createTransport({
		host,
		port,
		secure: String(env.SMTP_SECURE || '').toLowerCase() === 'true',
		auth: { user, pass },
	});
}

module.exports = {
	createMailerFromEnv,
};
