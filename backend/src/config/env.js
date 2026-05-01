require('dotenv').config();

function getEnv(name, fallback) {
	const value = process.env[name];
	return value == null || value === '' ? fallback : value;
}

module.exports = {
	getEnv,
};
