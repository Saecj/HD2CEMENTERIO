import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { Card } from '../ui'

export function AdminEmployeesModule({ employees, onRefresh }) {
	const PERMISSIONS = [
		{ key: 'graves', label: 'Tumbas', hint: 'Mapa, grilla, crear/editar parcelas' },
		{ key: 'deceased', label: 'Difuntos', hint: 'Registrar difuntos y entierros' },
		{ key: 'reservations', label: 'Reservas', hint: 'Gestionar reservas (confirmar/cancelar)' },
		{ key: 'payments', label: 'Pagos', hint: 'Gestionar pagos' },
		{ key: 'reports', label: 'Reporte', hint: 'Ver reportes (solo lectura de reservas/pagos)' },
	]

	function safeStorageGet(key) {
		try {
			return window.localStorage.getItem(key)
		} catch {
			return null
		}
	}
	function safeStorageSet(key, value) {
		try {
			window.localStorage.setItem(key, value)
		} catch {
			// ignore
		}
	}

	const [refreshing, setRefreshing] = useState(false)
	const storageKey = 'ui.admin.employees.seenMaxId'
	const [seenMaxId, setSeenMaxId] = useState(() => {
		const v = safeStorageGet(storageKey)
		const n = v != null ? Number(v) : null
		return Number.isFinite(n) ? n : null
	})

	const currentMaxId = useMemo(() => {
		const ids = employees.map((e) => Number(e.id)).filter((n) => Number.isFinite(n))
		return ids.length ? Math.max(...ids) : 0
	}, [employees])

	useEffect(() => {
		if (seenMaxId == null && currentMaxId > 0) {
			setSeenMaxId(currentMaxId)
			safeStorageSet(storageKey, String(currentMaxId))
		}
	}, [currentMaxId, seenMaxId])

	useEffect(() => {
		if (seenMaxId != null) safeStorageSet(storageKey, String(seenMaxId))
	}, [seenMaxId])

	const newCount = useMemo(() => {
		if (seenMaxId == null) return 0
		return employees.filter((e) => Number(e.id) > Number(seenMaxId)).length
	}, [employees, seenMaxId])
	const [roleEmail, setRoleEmail] = useState('')
	const [roleName, setRoleName] = useState('employee')
	const [roleLoading, setRoleLoading] = useState(false)
	const [roleMsg, setRoleMsg] = useState('')
	const canSetRole = useMemo(() => roleEmail.trim().includes('@'), [roleEmail])

	async function setRole(e) {
		e?.preventDefault()
		setRoleLoading(true)
		setRoleMsg('')
		try {
			const result = await api('/api/admin/users/role', {
				method: 'POST',
				body: JSON.stringify({ email: roleEmail, role: roleName }),
			})
			if (!result.ok) {
				setRoleMsg(result.data?.error || 'No se pudo asignar el rol')
				return
			}
			setRoleMsg('Rol asignado')
			setRoleEmail('')
			await onRefresh?.()
		} finally {
			setRoleLoading(false)
		}
	}

	const [eEmail, setEEmail] = useState('')
	const [eName, setEName] = useState('')
	const [ePhone, setEPhone] = useState('')
	const [ePassword, setEPassword] = useState('')
	const [eConfirmPassword, setEConfirmPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [ePerms, setEPerms] = useState(() => new Set(['graves', 'deceased', 'reservations', 'payments']))
	const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)
	const [eLoading, setELoading] = useState(false)
	const [eMsg, setEMsg] = useState('')
	const canCreateEmployee = useMemo(() => eEmail.includes('@'), [eEmail])

	const employeesByEmail = useMemo(() => {
		const map = new Map()
		for (const it of employees || []) {
			if (!it?.email) continue
			map.set(String(it.email).toLowerCase(), it)
		}
		return map
	}, [employees])

	const selectedEmployee = useMemo(() => {
		if (selectedEmployeeId == null) return null
		return employees.find((x) => String(x?.id) === String(selectedEmployeeId)) || null
	}, [employees, selectedEmployeeId])

	useEffect(() => {
		// Si el usuario escribe un email distinto, dejamos de "editar" la selección previa.
		const key = String(eEmail || '').trim().toLowerCase()
		const current = selectedEmployeeId != null ? employees.find((x) => String(x?.id) === String(selectedEmployeeId)) : null
		if (current?.email && key && String(current.email).toLowerCase() !== key) {
			setSelectedEmployeeId(null)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [eEmail])

	function togglePerm(key) {
		setEPerms((prev) => {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	async function createEmployee(e) {
		e?.preventDefault()
		setELoading(true)
		setEMsg('')
		try {
			const email = String(eEmail || '').trim()
			const password = String(ePassword || '')
			const confirmPassword = String(eConfirmPassword || '')
			const isExistingEmployee = employeesByEmail.has(String(email).toLowerCase())
			const wantsPasswordUpdate = Boolean(password || confirmPassword)

			if (!email || !email.includes('@')) {
				setEMsg('Email inválido.')
				return
			}
			if (!isExistingEmployee && !wantsPasswordUpdate) {
				setEMsg('Contraseña requerida para crear el empleado.')
				return
			}
			if (wantsPasswordUpdate) {
				if (!password || !confirmPassword) {
					setEMsg('Completa contraseña y confirmación.')
					return
				}
				if (password !== confirmPassword) {
					setEMsg('Las contraseñas no coinciden.')
					return
				}
			}

			const permissions = Array.from(ePerms)
			const payload = {
				email,
				fullName: eName,
				phone: ePhone,
				permissions,
			}
			if (wantsPasswordUpdate) {
				payload.password = password
				payload.confirmPassword = confirmPassword
			}
			const result = await api('/api/admin/employees', {
				method: 'POST',
				body: JSON.stringify({
					...payload,
				}),
			})
			if (!result.ok) {
				const code = result.data?.error
				if (code === 'EMAIL_INVALID') setEMsg('Email inválido.')
				else if (code === 'PASSWORD_REQUIRED') setEMsg('Este usuario no tiene contraseña aún: debes definir una para poder guardar cambios.')
				else if (code === 'PASSWORD_MISMATCH') setEMsg('Las contraseñas no coinciden.')
				else if (code === 'PASSWORD_TOO_SHORT') setEMsg('Contraseña muy corta (mínimo 8).')
				else if (code === 'PASSWORD_MISSING_UPPERCASE') setEMsg('La contraseña debe incluir una mayúscula.')
				else if (code === 'PASSWORD_MISSING_NUMBER') setEMsg('La contraseña debe incluir un número.')
				else if (code === 'PASSWORD_MISSING_SPECIAL') setEMsg('La contraseña debe incluir un símbolo (ej: !@#).')
				else if (code === 'PASSWORD_WEAK') setEMsg('Contraseña débil (usa más caracteres y mezcla letras/números).')
				else if (code === 'ROLES_NOT_INITIALIZED') setEMsg('Roles no inicializados en la base de datos.')
				else setEMsg(code || 'No se pudo guardar el empleado')
				return
			}
			setEMsg('Empleado creado/actualizado')
			setSelectedEmployeeId(null)
			setEEmail('')
			setEName('')
			setEPhone('')
			setEPassword('')
			setEConfirmPassword('')
			setShowPassword(false)
			setEPerms(new Set(['graves', 'deceased', 'reservations', 'payments']))
			await onRefresh?.()
		} finally {
			setELoading(false)
		}
	}

	function pickEmployee(emp) {
		if (!emp) return
		setSelectedEmployeeId(emp.id)
		setEMsg('')
		setEEmail(emp.email || '')
		setEName(emp.full_name || '')
		setEPhone(emp.phone || '')
		setEPassword('')
		setEConfirmPassword('')
		setShowPassword(false)
		const perms = Array.isArray(emp.permissions) ? emp.permissions : []
		setEPerms(new Set(perms))
	}

	async function doRefresh() {
		setRefreshing(true)
		try {
			await onRefresh?.()
		} finally {
			setRefreshing(false)
		}
	}

	return (
		<Card title="Gestionar empleados">
			<div className="grid gap-3 md:grid-cols-2">
				<section className="space-y-3">
					<form className="space-y-2" onSubmit={setRole}>
						<div className="text-xs font-medium text-[color:var(--text-h)]">Asignar rol a usuario</div>
				<input
					type="email"
					autoComplete="email"
					value={roleEmail}
					onChange={(e) => setRoleEmail(e.target.value)}
					className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					placeholder="usuario@correo.com"
				/>
				<div className="flex gap-2">
					<select
						value={roleName}
						onChange={(e) => setRoleName(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					>
						<option value="visitor">visitor</option>
						<option value="client">client</option>
						<option value="employee">employee</option>
						<option value="admin">admin</option>
					</select>
					<button
						disabled={!canSetRole || roleLoading}
						className="rounded-md bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
					>
						{roleLoading ? 'Asignando…' : 'Asignar'}
					</button>
				</div>
				{roleMsg && <p className="text-xs text-[color:var(--text)]">{roleMsg}</p>}
					</form>

					<form className="space-y-2" onSubmit={createEmployee}>
						<div className="flex items-center justify-between gap-2">
							<div className="text-xs font-medium text-[color:var(--text-h)]">Crear / actualizar empleado</div>
							{selectedEmployeeId != null && (
								<div className="text-[11px] text-[color:var(--muted)]">Editando: {String(eEmail || '').trim()}</div>
							)}
						</div>
				<input
					type="email"
					autoComplete="email"
					value={eEmail}
					onChange={(e) => {
						setEEmail(e.target.value)
						const found = employeesByEmail.get(String(e.target.value || '').trim().toLowerCase())
						if (found) setSelectedEmployeeId(found.id)
					}}
					className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					placeholder="empleado@correo.com"
				/>
				<input
					value={eName}
					onChange={(e) => setEName(e.target.value)}
					className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					placeholder="Nombre completo (opcional)"
				/>
				<input
					value={ePhone}
					onChange={(e) => setEPhone(e.target.value)}
					className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					placeholder="Celular (opcional)"
				/>
				<div className="flex items-center justify-between gap-2">
					<div className="text-xs text-[color:var(--text)]">Contraseña</div>
					<label className="flex items-center gap-2 text-xs text-[color:var(--text)]">
						<input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
						Mostrar
					</label>
				</div>
				{selectedEmployeeId != null && (
					<div className="text-[11px] text-[color:var(--muted)]">
						{selectedEmployee?.has_password
							? 'Contraseña configurada (por seguridad no se puede mostrar).'
							: 'Sin contraseña válida: define una para que pueda iniciar sesión.'}
					</div>
				)}
				<input
					type={showPassword ? 'text' : 'password'}
					autoComplete="new-password"
					value={ePassword}
					onChange={(e) => setEPassword(e.target.value)}
					className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					placeholder={selectedEmployeeId != null ? 'Contraseña (dejar en blanco para no cambiar)' : 'Contraseña'}
				/>
				<input
					type={showPassword ? 'text' : 'password'}
					autoComplete="new-password"
					value={eConfirmPassword}
					onChange={(e) => setEConfirmPassword(e.target.value)}
					className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					placeholder="Confirmar contraseña"
				/>
				<div className="rounded-md border border-[color:var(--border)] p-2">
					<div className="text-xs font-medium text-[color:var(--text-h)]">Permisos</div>
					<div className="mt-2 grid gap-2">
						{PERMISSIONS.map((p) => (
							<label key={p.key} className="flex items-start gap-2 text-sm text-[color:var(--text)]">
								<input
									type="checkbox"
									checked={ePerms.has(p.key)}
									onChange={() => togglePerm(p.key)}
									className="mt-1"
								/>
								<span>
									<span className="font-medium text-[color:var(--text-h)]">{p.label}</span>
									{p.hint ? <span className="ml-2 text-[11px] text-[color:var(--muted)]">{p.hint}</span> : null}
								</span>
							</label>
						))}
					</div>
					<div className="mt-2 text-[11px] text-[color:var(--muted)]">"Reporte" da acceso de solo lectura a reservas/pagos.</div>
				</div>
				<button
					disabled={!canCreateEmployee || eLoading}
					className="w-full rounded-md bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
				>
					{eLoading ? 'Guardando…' : selectedEmployeeId != null ? 'Actualizar empleado' : 'Crear empleado'}
				</button>
				{eMsg && <p className="text-xs text-[color:var(--text)]">{eMsg}</p>}
					</form>
				</section>

				<section className="space-y-3">
					<div className="flex items-center justify-between gap-2">
						<div className="text-xs text-[color:var(--text)]">Últimos empleados</div>
						<div className="flex items-center gap-2">
							{newCount > 0 && (
								<span className="rounded-full bg-[color:var(--surface-2)] px-2 py-1 text-[11px] font-medium text-[color:var(--az2)]">
									Nuevos: {newCount}
								</span>
							)}
							<button
								type="button"
								onClick={() => setSeenMaxId(currentMaxId || null)}
								disabled={employees.length === 0 || currentMaxId === 0 || newCount === 0}
								className="rounded-md border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--text-h)] hover:bg-[color:var(--hover)] disabled:opacity-50"
							>
								Marcar vistos
							</button>
							<button
								type="button"
								onClick={doRefresh}
								disabled={refreshing}
								className="rounded-md border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--text-h)] hover:bg-[color:var(--hover)] disabled:opacity-50"
							>
								{refreshing ? 'Actualizando…' : 'Actualizar'}
							</button>
						</div>
					</div>
					<div className="flex flex-wrap gap-3 text-[11px] text-[color:var(--text)]">
						<div className="flex items-center gap-2">
							<span className="inline-block h-2 w-2 rounded-full bg-[color:var(--az4)]" style={{ opacity: 0.35 }} />
							Nuevo
						</div>
						<div className="flex items-center gap-2">
							<span className="inline-block h-2 w-2 rounded-full bg-[color:var(--accent)]" style={{ opacity: 0.55 }} />
							Seleccionado
						</div>
					</div>
					<div className="max-h-[420px] overflow-y-auto rounded-md border border-[color:var(--border)] md:max-h-[560px]">
						{employees.length === 0 ? (
							<div className="p-3 text-sm text-[color:var(--text)]">Sin empleados.</div>
						) : (
							employees.slice(0, 200).map((emp) => {
								const isNew = Number(emp.id) > Number(seenMaxId || 0)
								const isSelected = selectedEmployeeId != null && String(emp.id) === String(selectedEmployeeId)
								const hasPassword = Boolean(emp?.has_password)
								return (
									<button
										key={emp.id ?? emp.email}
										type="button"
										onClick={() => pickEmployee(emp)}
										className={
											'block w-full text-left border-b border-[color:var(--border)] p-3 last:border-b-0 hover:bg-[color:var(--hover)] transition-colors ' +
											(isSelected ? 'bg-[color:var(--hover)]' : '')
										}
									>
										<div className="text-sm font-medium text-[color:var(--text-h)]">
											<span className={isNew ? 'text-[color:var(--az2)]' : ''}>{emp.email}</span>
											{isNew && (
												<span className="ml-2 rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--az2)]">
													NUEVO
												</span>
											)}
											{!hasPassword && (
												<span className="ml-2 rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--muted)]">
													SIN CLAVE
												</span>
											)}
											{isSelected && (
												<span className="ml-2 rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--accent)]">
													EDITANDO
												</span>
											)}
										</div>
										<div className="text-xs text-[color:var(--text)]">
											{emp.full_name ? emp.full_name : '—'}{emp.phone ? ` · ${emp.phone}` : ''}
										</div>
										<div className="mt-1 text-[11px] text-[color:var(--muted)]">
											Permisos: {Array.isArray(emp.permissions) && emp.permissions.length ? emp.permissions.join(', ') : '—'}
										</div>
									</button>
								)
							})
						)}
					</div>
				</section>
			</div>
		</Card>
	)
}
