import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { Card } from '../ui'

export function AdminReservationsModule({ reservations, graves, onRefresh }) {
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

	function statusUi(status) {
		switch (status) {
			case 'confirmed':
				return {
					label: 'Confirmada',
					className: 'bg-[color:var(--az3)] text-white border-[color:var(--az3)]',
					dot: 'bg-[color:var(--az3)]',
				}
			case 'cancelled':
				return {
					label: 'Cancelada',
					className: 'bg-[color:var(--az1)] text-white border-[color:var(--az1)]',
					dot: 'bg-[color:var(--az1)]',
				}
			case 'expired':
				return {
					label: 'Expirada',
					className: 'bg-[color:var(--az1)] text-white border-[color:var(--az1)]',
					dot: 'bg-[color:var(--az1)]',
				}
			case 'pending':
			default:
				return {
					label: 'Pendiente',
					className: 'bg-[color:var(--surface-2)] text-[color:var(--az2)] border-[color:var(--az4)]',
					dot: 'bg-[color:var(--az4)]',
				}
		}
	}

	const gravesWithoutDeceased = useMemo(() => graves.filter((g) => g?.status !== 'occupied'), [graves])

	const [refreshing, setRefreshing] = useState(false)
	const storageKey = 'ui.admin.reservations.seenMaxId'
	const [seenMaxId, setSeenMaxId] = useState(() => {
		const v = safeStorageGet(storageKey)
		const n = v != null ? Number(v) : null
		return Number.isFinite(n) ? n : null
	})

	const currentMaxId = useMemo(() => {
		const ids = reservations.map((r) => Number(r.id)).filter((n) => Number.isFinite(n))
		return ids.length ? Math.max(...ids) : 0
	}, [reservations])

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
		return reservations.filter((r) => Number(r.id) > Number(seenMaxId)).length
	}, [reservations, seenMaxId])

	const [rClientEmail, setRClientEmail] = useState('')
	const [rGraveId, setRGraveId] = useState('')
	const [rFrom, setRFrom] = useState('')
	const [rTo, setRTo] = useState('')
	const [rStatus, setRStatus] = useState('pending')
	const [rLoading, setRLoading] = useState(false)
	const [rMsg, setRMsg] = useState('')
	const canCreateReservation = useMemo(() => rClientEmail.includes('@') && rGraveId, [rClientEmail, rGraveId])

	async function createReservation(e) {
		e?.preventDefault()
		setRLoading(true)
		setRMsg('')
		try {
			const result = await api('/api/admin/reservations', {
				method: 'POST',
				body: JSON.stringify({
					clientEmail: rClientEmail,
					graveId: Number(rGraveId),
					reservedFrom: rFrom || null,
					reservedTo: rTo || null,
					status: rStatus,
				}),
			})
			if (!result.ok) {
				setRMsg(result.data?.error || 'No se pudo crear la reserva')
				return
			}
			setRMsg('Reserva creada')
			setRClientEmail('')
			setRGraveId('')
			setRFrom('')
			setRTo('')
			await onRefresh?.()
		} finally {
			setRLoading(false)
		}
	}

	const [rEditLoadingId, setREditLoadingId] = useState(null)
	async function updateReservationStatus(id, status) {
		setREditLoadingId(id)
		try {
			await api(`/api/admin/reservations/${id}`, {
				method: 'PATCH',
				body: JSON.stringify({ status }),
			})
			await onRefresh?.()
		} finally {
			setREditLoadingId(null)
		}
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
		<Card title="Gestionar reservas">
			<form className="space-y-2" onSubmit={createReservation}>
				<div className="text-xs text-[color:var(--text)]">Crear reserva</div>
				<input
					type="email"
					autoComplete="email"
					value={rClientEmail}
					onChange={(e) => setRClientEmail(e.target.value)}
					className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					placeholder="cliente@correo.com"
				/>
				<select
					value={rGraveId}
					onChange={(e) => setRGraveId(e.target.value)}
					className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
				>
					<option value="">Selecciona tumba</option>
					{gravesWithoutDeceased.map((g) => (
						<option key={g.id} value={String(g.id)}>
							{g.code} ({g.status})
						</option>
					))}
				</select>
				<div className="grid grid-cols-2 gap-2">
					<input
						type="date"
						value={rFrom}
						onChange={(e) => setRFrom(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					/>
					<input
						type="date"
						value={rTo}
						onChange={(e) => setRTo(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					/>
				</div>
				<select
					value={rStatus}
					onChange={(e) => setRStatus(e.target.value)}
					className={
						'w-full rounded-md border px-3 py-2 text-sm ' + statusUi(rStatus).className + ' disabled:opacity-50'
					}
				>
					<option value="pending">pending</option>
					<option value="confirmed">confirmed</option>
					<option value="cancelled">cancelled</option>
					<option value="expired">expired</option>
				</select>
				<button
					disabled={!canCreateReservation || rLoading}
					className="w-full rounded-md bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
				>
					{rLoading ? 'Creando…' : 'Crear reserva'}
				</button>
				{rMsg && <p className="text-xs text-[color:var(--text)]">{rMsg}</p>}
			</form>

			<div className="flex items-center justify-between gap-2">
				<div className="text-xs text-[color:var(--text)]">Últimas reservas</div>
				<div className="flex items-center gap-2">
					{newCount > 0 && (
						<span className="rounded-full bg-[color:var(--surface-2)] px-2 py-1 text-[11px] font-medium text-[color:var(--az2)]">
							Nuevos: {newCount}
						</span>
					)}
					<button
						type="button"
						onClick={() => setSeenMaxId(currentMaxId || null)}
						disabled={reservations.length === 0 || currentMaxId === 0 || newCount === 0}
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
					<span className={`inline-block h-2 w-2 rounded-full ${statusUi('pending').dot}`} />
					Pendiente
				</div>
				<div className="flex items-center gap-2">
					<span className={`inline-block h-2 w-2 rounded-full ${statusUi('confirmed').dot}`} />
					Confirmada
				</div>
				<div className="flex items-center gap-2">
					<span className={`inline-block h-2 w-2 rounded-full ${statusUi('cancelled').dot}`} />
					Cancelada/Expirada
				</div>
				<div className="flex items-center gap-2">
					<span className="inline-block h-2 w-2 rounded-full bg-[color:var(--az4)]" style={{ opacity: 0.35 }} />
					Nuevo
				</div>
			</div>

			<div className="max-h-[420px] overflow-y-auto rounded-md border border-[color:var(--border)] md:max-h-[560px]">
				{reservations.length === 0 ? (
					<div className="p-3 text-sm text-[color:var(--text)]">Sin reservas.</div>
				) : (
					reservations.slice(0, 200).map((r) => (
						<div
							key={r.id}
							className="flex items-center justify-between gap-2 border-b border-[color:var(--border)] p-3 last:border-b-0"
						>
							<div>
								<div className="text-sm font-medium text-[color:var(--text-h)]">
									<span className={Number(r.id) > Number(seenMaxId || 0) ? 'text-[color:var(--az2)]' : ''}>
										#{r.id} · {r.grave_code}
									</span>
									{Number(r.id) > Number(seenMaxId || 0) && (
										<span className="ml-2 rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--az2)]">
											NUEVO
										</span>
									)}
								</div>
								<div className="text-xs text-[color:var(--text)]">{r.client_email} · {statusUi(r.status).label}</div>
							</div>
							<select
								value={r.status}
								onChange={(e) => updateReservationStatus(r.id, e.target.value)}
								disabled={rEditLoadingId === r.id}
								className={
									'rounded-md border px-2 py-1 text-xs disabled:opacity-50 ' + statusUi(r.status).className
								}
							>
								<option value="pending">pending</option>
								<option value="confirmed">confirmed</option>
								<option value="cancelled">cancelled</option>
								<option value="expired">expired</option>
							</select>
						</div>
					))
				)}
			</div>
		</Card>
	)
}
