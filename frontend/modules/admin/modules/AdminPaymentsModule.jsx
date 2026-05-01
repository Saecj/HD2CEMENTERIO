import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { Card } from '../ui'

export function AdminPaymentsModule({ payments, paymentTypes, onRefresh }) {
	function statusUi(status) {
		switch (status) {
			case 'paid':
				return {
					label: 'Pagado',
					className: 'bg-[color:var(--az3)] text-white border-[color:var(--az3)]',
					dot: 'bg-[color:var(--az3)]',
				}
			case 'void':
				return {
					label: 'Anulado',
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

	const [pClientEmail, setPClientEmail] = useState('')
	const [pReservationId, setPReservationId] = useState('')
	const [pPaymentTypeId, setPPaymentTypeId] = useState('')
	const [pAmount, setPAmount] = useState('')
	const [pStatus, setPStatus] = useState('pending')
	const [pLoading, setPLoading] = useState(false)
	const [pMsg, setPMsg] = useState('')
	const [refreshing, setRefreshing] = useState(false)
	const [seenMaxId, setSeenMaxId] = useState(null)

	const currentMaxId = useMemo(() => {
		const ids = payments.map((p) => Number(p.id)).filter((n) => Number.isFinite(n))
		return ids.length ? Math.max(...ids) : 0
	}, [payments])

	useEffect(() => {
		// Al entrar al módulo por primera vez, marcamos como vistos los actuales.
		if (seenMaxId == null && currentMaxId > 0) setSeenMaxId(currentMaxId)
	}, [currentMaxId, seenMaxId])

	const newCount = useMemo(() => {
		if (seenMaxId == null) return 0
		return payments.filter((p) => Number(p.id) > Number(seenMaxId)).length
	}, [payments, seenMaxId])
	const canCreatePayment = useMemo(
		() => pClientEmail.includes('@') && pPaymentTypeId && Number(pAmount) > 0,
		[pClientEmail, pPaymentTypeId, pAmount],
	)

	async function createPayment(e) {
		e?.preventDefault()
		setPLoading(true)
		setPMsg('')
		try {
			const amountCents = Math.round(Number(pAmount) * 100)
			const result = await api('/api/admin/payments', {
				method: 'POST',
				body: JSON.stringify({
					clientEmail: pClientEmail,
					reservationId: pReservationId ? Number(pReservationId) : null,
					paymentTypeId: Number(pPaymentTypeId),
					amountCents,
					currency: 'PEN',
					status: pStatus,
				}),
			})
			if (!result.ok) {
				setPMsg(result.data?.error || 'No se pudo crear el pago')
				return
			}
			setPMsg('Pago registrado')
			setPClientEmail('')
			setPReservationId('')
			setPPaymentTypeId('')
			setPAmount('')
			setPStatus('pending')
			await onRefresh?.()
		} finally {
			setPLoading(false)
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

	const [pEditLoadingId, setPEditLoadingId] = useState(null)
	async function updatePaymentStatus(id, status) {
		setPEditLoadingId(id)
		try {
			await api(`/api/admin/payments/${id}`, {
				method: 'PATCH',
				body: JSON.stringify({ status }),
			})
			await onRefresh?.()
		} finally {
			setPEditLoadingId(null)
		}
	}

	return (
		<Card title="Gestionar pagos">
			<form className="space-y-2" onSubmit={createPayment}>
				<div className="text-xs text-[color:var(--text)]">Registrar pago</div>
				<input
					type="email"
					autoComplete="email"
					value={pClientEmail}
					onChange={(e) => setPClientEmail(e.target.value)}
					className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					placeholder="cliente@correo.com"
				/>
				<div className="grid grid-cols-2 gap-2">
					<select
						value={pPaymentTypeId}
						onChange={(e) => setPPaymentTypeId(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					>
						<option value="">Tipo</option>
						{paymentTypes.map((t) => (
							<option key={t.id} value={String(t.id)}>
								{t.name}
							</option>
						))}
					</select>
					<input
						value={pAmount}
						onChange={(e) => setPAmount(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
						placeholder="Monto (PEN)"
						inputMode="decimal"
					/>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<input
						value={pReservationId}
						onChange={(e) => setPReservationId(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
						placeholder="Reserva # (opcional)"
						inputMode="numeric"
					/>
					<select
						value={pStatus}
						onChange={(e) => setPStatus(e.target.value)}
						className={
							'w-full rounded-md border px-3 py-2 text-sm ' +
							statusUi(pStatus).className +
							' disabled:opacity-50'
						}
					>
						<option value="pending">pending</option>
						<option value="paid">paid</option>
						<option value="void">void</option>
					</select>
				</div>
				<button
					disabled={!canCreatePayment || pLoading}
					className={
						'w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ' +
						(pStatus === 'paid'
							? 'bg-[color:var(--az3)] text-white'
							: pStatus === 'void'
								? 'bg-[color:var(--az1)] text-white'
								: 'bg-[color:var(--accent)] text-white')
					}
				>
					{pLoading ? 'Registrando…' : 'Registrar pago'}
				</button>
				{pMsg && <p className="text-xs text-[color:var(--text)]">{pMsg}</p>}
			</form>

			<div className="flex items-center justify-between gap-2">
				<div className="text-xs text-[color:var(--text)]">Últimos pagos</div>
				<div className="flex items-center gap-2">
					{newCount > 0 && (
						<span className="rounded-full bg-[color:var(--surface-2)] px-2 py-1 text-[11px] font-medium text-[color:var(--az2)]">
							Nuevos: {newCount}
						</span>
					)}
					<button
						type="button"
						onClick={() => setSeenMaxId(currentMaxId || null)}
						disabled={payments.length === 0 || currentMaxId === 0 || newCount === 0}
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
					<span className={`inline-block h-2 w-2 rounded-full ${statusUi('paid').dot}`} />
					Pagado
				</div>
				<div className="flex items-center gap-2">
					<span className={`inline-block h-2 w-2 rounded-full ${statusUi('void').dot}`} />
					Anulado
				</div>
				<div className="flex items-center gap-2">
					<span className="inline-block h-2 w-2 rounded-full bg-[color:var(--az4)]" style={{ opacity: 0.35 }} />
					Nuevo
				</div>
			</div>

			<div className="max-h-[420px] overflow-y-auto rounded-md border border-[color:var(--border)] md:max-h-[560px]">
				{payments.length === 0 ? (
					<div className="p-3 text-sm text-[color:var(--text)]">Sin pagos.</div>
				) : (
					payments.slice(0, 200).map((p) => (
						<div
							key={p.id}
							className="flex items-center justify-between gap-2 border-b border-[color:var(--border)] p-3 last:border-b-0"
						>
							<div>
								<div className="text-sm font-medium text-[color:var(--text-h)]">
									<span
										className={
											'inline-flex items-center gap-2 ' +
											(Number(p.id) > Number(seenMaxId || 0) ? 'text-[color:var(--az2)]' : '')
										}
									>
										#{p.id} · {(p.amount_cents / 100).toFixed(2)} {p.currency}
										{Number(p.id) > Number(seenMaxId || 0) && (
											<span className="rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--az2)]">
												NUEVO
											</span>
										)}
									</span>
								</div>
								<div className="text-xs text-[color:var(--text)]">
									{p.client_email} · {p.payment_type_name} · {statusUi(p.status).label}
								</div>
							</div>
							<select
								value={p.status}
								onChange={(e) => updatePaymentStatus(p.id, e.target.value)}
								disabled={pEditLoadingId === p.id}
								className={
									'rounded-md border px-2 py-1 text-xs disabled:opacity-50 ' + statusUi(p.status).className
								}
							>
								<option value="pending">pending</option>
								<option value="paid">paid</option>
								<option value="void">void</option>
							</select>
						</div>
					))
				)}
			</div>
		</Card>
	)
}
