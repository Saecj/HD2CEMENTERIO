import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { Panel } from '../../layout/Panel'

function prettyGraveStatus(status) {
	if (!status) return '—'
	const s = String(status)
	const map = {
		available: 'Disponible',
		occupied: 'Ocupada',
		reserved: 'Reservada',
		maintenance: 'Mantenimiento',
	}
	return map[s] || s
}

export function ClientProfileModule({ me, showLoggedOutMessage, onLogout, onMeRefresh }) {
	const [clientProfile, setClientProfile] = useState(null)
	const [reservations, setReservations] = useState([])
	const [loading, setLoading] = useState(false)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	const [editOpen, setEditOpen] = useState(false)
	const [draft, setDraft] = useState({ username: '', full_name: '', document_id: '', phone: '' })
	const [saveError, setSaveError] = useState('')

	useEffect(() => {
		let cancelled = false
		async function load() {
			if (!me) return
			setLoading(true)
			setError('')
			try {
				const [profileRes, resvRes] = await Promise.all([
					api('/api/client/profile'),
					api('/api/client/reservations'),
				])

				if (!cancelled) {
					if (profileRes?.ok) {
						const next = profileRes.data?.client ?? null
						setClientProfile(next)
						setDraft({
								username: me?.username || '',
							full_name: next?.full_name || '',
							document_id: next?.document_id || '',
							phone: next?.phone || '',
						})
					} else {
						// Fallback si el endpoint no existe aún o falla.
						setClientProfile(null)
							setDraft({ username: me?.username || '', full_name: '', document_id: '', phone: '' })
					}

					if (resvRes?.ok) {
						setReservations(Array.isArray(resvRes.data?.reservations) ? resvRes.data.reservations : [])
					} else {
						setReservations([])
						setError(resvRes?.data?.error || 'No se pudieron cargar tus registros')
					}
				}
			} finally {
				if (!cancelled) setLoading(false)
			}
		}
		load()
		return () => {
			cancelled = true
		}
	}, [me?.id])

	async function saveProfile() {
		setSaving(true)
		setSaveError('')
		try {
			const payload = {
				username: String(draft.username || '').trim(),
				fullName: String(draft.full_name || '').trim(),
				documentId: String(draft.document_id || '').trim(),
				phone: String(draft.phone || '').trim(),
			}
			const result = await api('/api/client/profile', {
				method: 'PUT',
				body: JSON.stringify(payload),
			})
			if (!result.ok) {
				setSaveError(result.data?.error || 'No se pudo guardar')
				return
			}
			const next = result.data?.client ?? null
			setClientProfile(next)
			setDraft({
				username: payload.username,
				full_name: next?.full_name || payload.fullName || '',
				document_id: next?.document_id || payload.documentId || '',
				phone: next?.phone || payload.phone || '',
			})
			setEditOpen(false)
			// Refresca 'me' para que se vea el username en Navbar y en Perfil.
			try {
				await onMeRefresh?.()
			} catch {
				// ignore
			}
		} finally {
			setSaving(false)
		}
	}

	function displayUsername() {
		const u = String(me?.username || '').trim()
		if (u) return u
		const email = String(me?.email || '').trim()
		if (email.includes('@')) return email.split('@')[0]
		return email || 'Usuario'
	}

	const peopleFromSearch = useMemo(() => {
		// Coincide con lo que muestra la pestaña Búsqueda (reservas del cliente)
		return reservations
	}, [reservations])

	return (
		<Panel>
			{me ? (
				<div className="space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-3">
							<div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-2)] text-[color:var(--text-h)]">
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<path d="M20 21a8 8 0 0 0-16 0" />
									<circle cx="12" cy="7" r="4" />
								</svg>
							</div>
							<div>
								<div className="text-sm font-semibold text-[color:var(--text-h)]">Perfil</div>
								<div className="text-xs text-[color:var(--text)]">{displayUsername()}</div>
								<div className="text-[11px] text-[color:var(--muted)]">{me.email}</div>
							</div>
						</div>
					</div>

					{error ? <div className="text-sm text-red-600">{error}</div> : null}

					<div className="grid gap-3 md:grid-cols-2">
						<div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4">
							<div className="flex items-center justify-between gap-3">
								<div className="text-sm font-semibold text-[color:var(--text-h)]">Cuenta</div>
								<button
									onClick={() => {
										setSaveError('')
										setDraft({
										username: me?.username || '',
											full_name: clientProfile?.full_name || '',
											document_id: clientProfile?.document_id || '',
											phone: clientProfile?.phone || '',
										})
										setEditOpen((v) => !v)
								}}
									type="button"
									className="rounded-md border border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
								>
									{editOpen ? 'Cancelar' : 'Editar'}
								</button>
							</div>
							<div className="mt-3 grid gap-2 text-sm text-[color:var(--text)]">
								<div className="flex items-center justify-between gap-3">
									<span className="text-[color:var(--muted)]">Usuario</span>
									<span className="font-medium text-[color:var(--text-h)]">{me.username || '—'}</span>
								</div>
								<div className="flex items-center justify-between gap-3">
									<span className="text-[color:var(--muted)]">Correo</span>
									<span className="font-medium text-[color:var(--text-h)]">{me.email}</span>
								</div>
								<div className="flex items-center justify-between gap-3">
									<span className="text-[color:var(--muted)]">Rol</span>
									<span className="font-medium text-[color:var(--text-h)]">{me.role}</span>
								</div>
								{!editOpen ? (
									<>
										<div className="flex items-center justify-between gap-3">
											<span className="text-[color:var(--muted)]">Nombre</span>
											<span className="font-medium text-[color:var(--text-h)]">{clientProfile?.full_name || '—'}</span>
										</div>
										<div className="flex items-center justify-between gap-3">
											<span className="text-[color:var(--muted)]">DNI</span>
											<span className="font-medium text-[color:var(--text-h)]">{clientProfile?.document_id || '—'}</span>
										</div>
										<div className="flex items-center justify-between gap-3">
											<span className="text-[color:var(--muted)]">Celular</span>
											<span className="font-medium text-[color:var(--text-h)]">{clientProfile?.phone || '—'}</span>
										</div>
								</>
								) : (
									<div className="mt-2 space-y-2">
										<div>
											<label className="block text-xs text-[color:var(--text)]">Usuario</label>
											<input
												value={draft.username}
												onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
												className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm text-[color:var(--text-h)]"
												placeholder="Tu usuario"
												autoComplete="username"
												maxLength={24}
											/>
											<div className="mt-1 text-[11px] text-[color:var(--muted)]">2–24 caracteres.</div>
										</div>
										<div>
											<label className="block text-xs text-[color:var(--text)]">Nombre</label>
											<input
												value={draft.full_name}
												onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
												className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm text-[color:var(--text-h)]"
												placeholder="Tu nombre"
												autoComplete="name"
											/>
										</div>
										<div>
											<label className="block text-xs text-[color:var(--text)]">DNI</label>
											<input
												value={draft.document_id}
												onChange={(e) => setDraft((d) => ({ ...d, document_id: e.target.value }))}
												className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm text-[color:var(--text-h)]"
												placeholder="Documento"
												autoComplete="off"
											/>
										</div>
										<div>
											<label className="block text-xs text-[color:var(--text)]">Celular</label>
											<input
												value={draft.phone}
												onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
												className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm text-[color:var(--text-h)]"
												placeholder="Número"
												autoComplete="tel"
											/>
										</div>

										{saveError ? <div className="text-sm text-red-600">{saveError}</div> : null}
										<div className="flex justify-end">
											<button
												onClick={() => saveProfile()}
												type="button"
												disabled={saving}
												className="rounded-md bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-[color:var(--on-accent)] disabled:opacity-50"
											>
												{saving ? 'Guardando…' : 'Guardar'}
											</button>
										</div>
									</div>
								)}
							</div>
						</div>

						<div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4">
							<div className="flex items-center justify-between gap-3">
								<div className="text-sm font-semibold text-[color:var(--text-h)]">Personas (Búsqueda)</div>
								{loading ? <div className="text-xs text-[color:var(--text)]">Cargando…</div> : null}
							</div>
							{!loading && peopleFromSearch.length === 0 ? (
								<div className="mt-2 text-sm text-[color:var(--text)]">Aún no hay registros.</div>
							) : null}
							{peopleFromSearch.length > 0 ? (
								<div className="mt-3 space-y-2">
									{peopleFromSearch.slice(0, 12).map((it) => (
										<div key={`prof-resv-${it.id}`} className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
											<div className="text-sm font-semibold text-[color:var(--text-h)]">{it.deceased_full_name || '—'}</div>
											<div className="mt-1 text-xs text-[color:var(--text)]">Reserva: {it.reservation_code || '—'}</div>
											<div className="mt-1 text-xs text-[color:var(--text)]">Tumba: {it.grave_code || '—'} · {prettyGraveStatus(it.grave_status)}</div>
										</div>
									))}
									{peopleFromSearch.length > 12 ? (
										<div className="text-xs text-[color:var(--text)]">Mostrando 12 de {peopleFromSearch.length}.</div>
									) : null}
								</div>
							) : null}
						</div>
					</div>

				</div>
			) : showLoggedOutMessage ? (
				<div className="text-sm text-[color:var(--text)]">Inicia sesión o regístrate desde la barra superior.</div>
			) : (
				<div className="text-sm text-[color:var(--text)]">—</div>
			)}
		</Panel>
	)
}
