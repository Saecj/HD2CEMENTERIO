function requireAuth(req, res, next) {
	if (!req.session?.user) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
	return next();
}

function requireRole(roles) {
	const allowed = Array.isArray(roles) ? roles : [roles];
	return (req, res, next) => {
		if (!req.session?.user) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
		const role = req.session.user.role;
		if (!role || !allowed.includes(role)) {
			return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
		}
		return next();
	};
}

function normalizePermissions(value) {
	if (!Array.isArray(value)) return [];
	return value.map((p) => String(p || '').trim()).filter(Boolean);
}

function hasAnyPermission(user, required) {
	const role = user?.role;
	if (role === 'admin') return true;
	if (role !== 'employee') return false;
	const userPerms = new Set(normalizePermissions(user?.permissions));
	const requiredPerms = normalizePermissions(required);
	if (requiredPerms.length === 0) return true;
	return requiredPerms.some((p) => userPerms.has(p));
}

// Exige que el usuario (employee) tenga el permiso indicado. Admin siempre pasa.
function requirePermission(permissionOrList) {
	const required = Array.isArray(permissionOrList) ? permissionOrList : [permissionOrList];
	return (req, res, next) => {
		if (!req.session?.user) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
		if (!hasAnyPermission(req.session.user, required)) {
			return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
		}
		return next();
	};
}

module.exports = {
	requireAuth,
	requireRole,
	requirePermission,
};
