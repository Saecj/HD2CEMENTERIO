import { useEffect, useMemo, useState } from 'react'
import { Card } from '../ui'

export function AdminReportsModule({ reservations, payments, onRefresh }) {
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

	function reservationStatusUi(status) {
		switch (status) {
			case 'confirmed':
				return { label: 'Confirmada', className: 'bg-[color:var(--az3)] text-white border-[color:var(--az3)]', dot: 'bg-[color:var(--az3)]' }
			case 'cancelled':
				return { label: 'Cancelada', className: 'bg-[color:var(--az1)] text-white border-[color:var(--az1)]', dot: 'bg-[color:var(--az1)]' }
			case 'expired':
				return { label: 'Expirada', className: 'bg-[color:var(--az1)] text-white border-[color:var(--az1)]', dot: 'bg-[color:var(--az1)]' }
			case 'pending':
			default:
				return { label: 'Pendiente', className: 'bg-[color:var(--surface-2)] text-[color:var(--az2)] border-[color:var(--az4)]', dot: 'bg-[color:var(--az4)]' }
		}
	}
	function paymentStatusUi(status) {
		switch (status) {
			case 'paid':
				return { label: 'Pagado', className: 'bg-[color:var(--az3)] text-white border-[color:var(--az3)]', dot: 'bg-[color:var(--az3)]' }
			case 'void':
				return { label: 'Anulado', className: 'bg-[color:var(--az1)] text-white border-[color:var(--az1)]', dot: 'bg-[color:var(--az1)]' }
			case 'pending':
			default:
				return { label: 'Pendiente', className: 'bg-[color:var(--surface-2)] text-[color:var(--az2)] border-[color:var(--az4)]', dot: 'bg-[color:var(--az4)]' }
		}
	}

	const [refreshing, setRefreshing] = useState(false)

	const rStorageKey = 'ui.admin.reports.reservations.seenMaxId'
	const [rSeenMaxId, setRSeenMaxId] = useState(() => {
		const v = safeStorageGet(rStorageKey)
		const n = v != null ? Number(v) : null
		return Number.isFinite(n) ? n : null
	})
	const rCurrentMaxId = useMemo(() => {
		const ids = reservations.map((r) => Number(r.id)).filter((n) => Number.isFinite(n))
		return ids.length ? Math.max(...ids) : 0
	}, [reservations])
	useEffect(() => {
		if (rSeenMaxId == null && rCurrentMaxId > 0) {
			setRSeenMaxId(rCurrentMaxId)
			safeStorageSet(rStorageKey, String(rCurrentMaxId))
		}
	}, [rCurrentMaxId, rSeenMaxId])
	useEffect(() => {
		if (rSeenMaxId != null) safeStorageSet(rStorageKey, String(rSeenMaxId))
	}, [rSeenMaxId])
	const rNewCount = useMemo(() => {
		if (rSeenMaxId == null) return 0
		return reservations.filter((r) => Number(r.id) > Number(rSeenMaxId)).length
	}, [reservations, rSeenMaxId])

	const pStorageKey = 'ui.admin.reports.payments.seenMaxId'
	const [pSeenMaxId, setPSeenMaxId] = useState(() => {
		const v = safeStorageGet(pStorageKey)
		const n = v != null ? Number(v) : null
		return Number.isFinite(n) ? n : null
	})
	const pCurrentMaxId = useMemo(() => {
		const ids = payments.map((p) => Number(p.id)).filter((n) => Number.isFinite(n))
		return ids.length ? Math.max(...ids) : 0
	}, [payments])
	useEffect(() => {
		if (pSeenMaxId == null && pCurrentMaxId > 0) {
			setPSeenMaxId(pCurrentMaxId)
			safeStorageSet(pStorageKey, String(pCurrentMaxId))
		}
	}, [pCurrentMaxId, pSeenMaxId])
	useEffect(() => {
		if (pSeenMaxId != null) safeStorageSet(pStorageKey, String(pSeenMaxId))
	}, [pSeenMaxId])
	const pNewCount = useMemo(() => {
		if (pSeenMaxId == null) return 0
		return payments.filter((p) => Number(p.id) > Number(pSeenMaxId)).length
	}, [payments, pSeenMaxId])

	async function doRefresh() {
		setRefreshing(true)
		try {
			await onRefresh?.()
		} finally {
			setRefreshing(false)
		}
	}

	return (
		<Card title="Reporte">
			<div className="text-sm text-[color:var(--text)]">Resumen operativo con los últimos movimientos registrados.</div>
			<div className="mt-2 flex items-center justify-end gap-2">
				<button
					type="button"
					onClick={doRefresh}
					disabled={refreshing}
					className="rounded-md border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--text-h)] hover:bg-[color:var(--hover)] disabled:opacity-50"
				>
					{refreshing ? 'Actualizando…' : 'Actualizar'}
				</button>
			</div>
			<div className="grid gap-3 md:grid-cols-2">
				<div className="rounded-md border border-[color:var(--border)]">
					<div className="border-b border-[color:var(--border)] px-3 py-2 text-xs font-medium text-[color:var(--text)]">
						<div className="flex items-center justify-between gap-2">
							<span>Reservas</span>
							<div className="flex items-center gap-2">
								{rNewCount > 0 && (
									<span className="rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--az2)]">
										Nuevos: {rNewCount}
									</span>
								)}
								<button
									type="button"
									onClick={() => setRSeenMaxId(rCurrentMaxId || null)}
									disabled={reservations.length === 0 || rCurrentMaxId === 0 || rNewCount === 0}
									className="rounded-md border border-[color:var(--border)] px-2 py-0.5 text-[11px] text-[color:var(--text-h)] hover:bg-[color:var(--hover)] disabled:opacity-50"
								>
									Marcar vistos
								</button>
							</div>
						</div>
					</div>
					<div className="px-3 py-2 text-[11px] text-[color:var(--text)]">
						<div className="flex flex-wrap gap-3">
							<div className="flex items-center gap-2">
								<span className={`inline-block h-2 w-2 rounded-full ${reservationStatusUi('pending').dot}`} />
								Pendiente
							</div>
							<div className="flex items-center gap-2">
								<span className={`inline-block h-2 w-2 rounded-full ${reservationStatusUi('confirmed').dot}`} />
								Confirmada
							</div>
							<div className="flex items-center gap-2">
								<span className={`inline-block h-2 w-2 rounded-full ${reservationStatusUi('cancelled').dot}`} />
								Cancelada/Expirada
							</div>
							<div className="flex items-center gap-2">
								<span className="inline-block h-2 w-2 rounded-full bg-[color:var(--az4)]" style={{ opacity: 0.35 }} />
								Nuevo
							</div>
						</div>
					</div>
					<div className="max-h-[420px] overflow-y-auto md:max-h-[560px]">
						{reservations.length === 0 ? (
							<div className="p-3 text-sm text-[color:var(--text)]">Sin reservas.</div>
						) : (
							reservations.slice(0, 200).map((r) => (
								<div key={r.id} className="border-b border-[color:var(--border)] p-3 last:border-b-0">
									<div className="text-sm font-medium text-[color:var(--text-h)]">
										<span className={Number(r.id) > Number(rSeenMaxId || 0) ? 'text-[color:var(--az2)]' : ''}>
											#{r.id} · {r.grave_code}
										</span>
										{Number(r.id) > Number(rSeenMaxId || 0) && (
											<span className="ml-2 rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--az2)]">
												NUEVO
											</span>
										)}
										<span className={
											'ml-2 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] ' +
											reservationStatusUi(r.status).className
										}
										>
											{reservationStatusUi(r.status).label}
										</span>
									</div>
									<div className="text-xs text-[color:var(--text)]">{r.client_email}</div>
								</div>
							))
						)}
					</div>
				</div>
				<div className="rounded-md border border-[color:var(--border)]">
					<div className="border-b border-[color:var(--border)] px-3 py-2 text-xs font-medium text-[color:var(--text)]">
						<div className="flex items-center justify-between gap-2">
							<span>Pagos</span>
							<div className="flex items-center gap-2">
								{pNewCount > 0 && (
									<span className="rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--az2)]">
										Nuevos: {pNewCount}
									</span>
								)}
								<button
									type="button"
									onClick={() => setPSeenMaxId(pCurrentMaxId || null)}
									disabled={payments.length === 0 || pCurrentMaxId === 0 || pNewCount === 0}
									className="rounded-md border border-[color:var(--border)] px-2 py-0.5 text-[11px] text-[color:var(--text-h)] hover:bg-[color:var(--hover)] disabled:opacity-50"
								>
									Marcar vistos
								</button>
							</div>
						</div>
					</div>
					<div className="px-3 py-2 text-[11px] text-[color:var(--text)]">
						<div className="flex flex-wrap gap-3">
							<div className="flex items-center gap-2">
								<span className={`inline-block h-2 w-2 rounded-full ${paymentStatusUi('pending').dot}`} />
								Pendiente
							</div>
							<div className="flex items-center gap-2">
								<span className={`inline-block h-2 w-2 rounded-full ${paymentStatusUi('paid').dot}`} />
								Pagado
							</div>
							<div className="flex items-center gap-2">
								<span className={`inline-block h-2 w-2 rounded-full ${paymentStatusUi('void').dot}`} />
								Anulado
							</div>
							<div className="flex items-center gap-2">
								<span className="inline-block h-2 w-2 rounded-full bg-[color:var(--az4)]" style={{ opacity: 0.35 }} />
								Nuevo
							</div>
						</div>
					</div>
					<div className="max-h-[420px] overflow-y-auto md:max-h-[560px]">
						{payments.length === 0 ? (
							<div className="p-3 text-sm text-[color:var(--text)]">Sin pagos.</div>
						) : (
							payments.slice(0, 200).map((p) => (
								<div key={p.id} className="border-b border-[color:var(--border)] p-3 last:border-b-0">
									<div className="text-sm font-medium text-[color:var(--text-h)]">
										<span className={Number(p.id) > Number(pSeenMaxId || 0) ? 'text-[color:var(--az2)]' : ''}>
											#{p.id} · {(p.amount_cents / 100).toFixed(2)} {p.currency}
										</span>
										{Number(p.id) > Number(pSeenMaxId || 0) && (
											<span className="ml-2 rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--az2)]">
												NUEVO
											</span>
										)}
										<span className={
											'ml-2 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] ' +
											paymentStatusUi(p.status).className
										}
										>
											{paymentStatusUi(p.status).label}
										</span>
									</div>
									<div className="text-xs text-[color:var(--text)]">{p.client_email} · {p.payment_type_name}</div>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</Card>
	)
}
