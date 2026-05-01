import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'

function formatMoney(cents, currency) {
	const amount = Number(cents || 0) / 100
	const cur = currency || 'PEN'
	try {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(amount)
	} catch {
		return `${amount.toFixed(2)} ${cur}`
	}
}

function formatDateTime(value) {
	if (!value) return '—'
	try {
		return new Date(value).toLocaleString()
	} catch {
		return String(value)
	}
}

function prettyStatus(status) {
	if (!status) return '—'
	const s = String(status)
	const map = {
		pending: 'Pendiente',
		paid: 'Pagado',
		void: 'Anulado',
	}
	return map[s] || s
}

function paymentTypeLabel(name) {
	const key = String(name || '').trim()
	if (!key) return '—'
	const map = {
		cash: 'Efectivo',
		card_credit: 'Tarjeta de crédito',
		card_debit: 'Tarjeta de débito',
		card: 'Tarjeta',
	}
	return map[key] || key
}

function detectCardBrand(raw) {
	const digits = String(raw || '').replace(/\D/g, '')
	if (!digits) return ''
	if (digits.startsWith('4')) return 'Visa'
	const first2 = Number(digits.slice(0, 2))
	const first4 = Number(digits.slice(0, 4))
	if (first2 >= 51 && first2 <= 55) return 'Mastercard'
	if (first4 >= 2221 && first4 <= 2720) return 'Mastercard'
	return '—'
}

function cardMaxLength(brand) {
	if (brand === 'Mastercard') return 16
	if (brand === 'Visa') return 19
	return 19
}

function isValidCardLength(digits, brand) {
	const len = String(digits || '').replace(/\D/g, '').length
	if (len === 0) return false
	if (brand === 'Mastercard') return len === 16
	if (brand === 'Visa') return len === 13 || len === 16 || len === 19
	return len >= 13 && len <= 19
}

function solesToCents(input) {
	const raw = String(input || '').trim()
	if (!raw) return NaN
	const normalized = raw.replace(',', '.')
	if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return NaN
	const value = Number(normalized)
	if (!Number.isFinite(value)) return NaN
	return Math.round(value * 100)
}

function centsToSolesText(cents) {
	const n = Number(cents)
	if (!Number.isFinite(n)) return ''
	return (n / 100).toFixed(2)
}

export function MyPaymentsView({ me, onLogin, intent, onIntentHandled, filterSeed }) {
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [items, setItems] = useState([])
	const [filterQ, setFilterQ] = useState('')

	const [types, setTypes] = useState([])
	const [reservationCode, setReservationCode] = useState('')
	const [paymentTypeId, setPaymentTypeId] = useState('')
	const [amountSoles, setAmountSoles] = useState('')
	const [cardNumber, setCardNumber] = useState('')
	const [creating, setCreating] = useState(false)
	const [createMsg, setCreateMsg] = useState('')
	const [payOpen, setPayOpen] = useState(false)
	const [summary, setSummary] = useState(null)
	const [summaryLoading, setSummaryLoading] = useState(false)
	const [summaryError, setSummaryError] = useState('')

	const paidTotal = useMemo(() => {
		return items
			.filter((p) => p.status === 'paid')
			.reduce((sum, p) => sum + Number(p.amount_cents || 0), 0)
	}, [items])

	useEffect(() => {
		if (!filterSeed?.ts) return
		const nextQ = typeof filterSeed.q === 'string' ? filterSeed.q : ''
		setFilterQ(nextQ)
	}, [filterSeed?.ts])

	const filteredItems = useMemo(() => {
		const raw = String(filterQ || '').trim()
		const q = raw.toLowerCase()
		if (!q) return items

		const wantsPending = q.includes('pendiente')
		const wantsPaid = q.includes('pagado') || q.includes('pagados')
		const match = raw.match(/\bRSV[-\w]+\b/i)
		const rsvCode = match ? match[0].toLowerCase() : ''

		let rows = items
		if (wantsPending && !wantsPaid) rows = rows.filter((p) => p.status === 'pending')
		if (wantsPaid && !wantsPending) rows = rows.filter((p) => p.status === 'paid')
		if (rsvCode) rows = rows.filter((p) => String(p.reservation_code || '').toLowerCase().includes(rsvCode))

		if (!wantsPending && !wantsPaid && !rsvCode) {
			rows = rows.filter((p) => {
				const haystack = [
					p.reservation_code,
					p.grave_code,
					p.payment_type_name,
					p.status,
				]
					.filter((v) => v != null && String(v).trim() !== '')
					.join(' ')
					.toLowerCase()
				return haystack.includes(q)
			})
		}

		return rows
	}, [items, filterQ])

	useEffect(() => {
		let cancelled = false
		async function load() {
			if (!me) return
			setLoading(true)
			setError('')
			try {
				const result = await api('/api/client/payments')
				if (!result.ok) {
					setError(result.data?.error || 'No se pudieron cargar tus pagos')
					setItems([])
					return
				}
				if (!cancelled) setItems(Array.isArray(result.data?.payments) ? result.data.payments : [])
			} finally {
				if (!cancelled) setLoading(false)
			}
		}
		load()
		return () => {
			cancelled = true
		}
	}, [me])

	useEffect(() => {
		if (!me) return
		const code = intent?.reservationCode
		if (!code) return
		setCreateMsg('')
		setError('')
		setSummaryError('')
		setReservationCode(String(code))
		setPayOpen(true)
		if (typeof onIntentHandled === 'function') onIntentHandled()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [me, intent?.ts])

	useEffect(() => {
		let cancelled = false
		async function loadTypes() {
			if (!me) return
			const result = await api('/api/payment-types')
			if (!result.ok) return
			const rows = Array.isArray(result.data?.paymentTypes) ? result.data.paymentTypes : []
			if (!cancelled) {
				setTypes(rows)
				if (!paymentTypeId) {
					const cash = rows.find((r) => String(r.name) === 'cash')
					if (cash?.id != null) setPaymentTypeId(String(cash.id))
					else if (rows[0]?.id) setPaymentTypeId(String(rows[0].id))
				}
			}
		}
		loadTypes()
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [me])

	async function refresh() {
		if (!me) return
		setLoading(true)
		setError('')
		try {
			const result = await api('/api/client/payments')
			if (!result.ok) {
				setError(result.data?.error || 'No se pudieron cargar tus pagos')
				setItems([])
				return
			}
			setItems(Array.isArray(result.data?.payments) ? result.data.payments : [])
		} finally {
			setLoading(false)
		}
	}

	const canCreate = useMemo(() => {
		if (creating) return false
		if (!reservationCode.trim()) return false
		if (!paymentTypeId) return false
		const cents = solesToCents(amountSoles)
		if (!Number.isFinite(cents) || cents <= 0) return false
		if (summary) {
			if (summary.reservation_status !== 'confirmed') return false
			const due = Number(summary.due_cents || 0)
			if (!(due > 0)) return false
			if (cents !== due) return false
		}
		const selectedType = types.find((t) => String(t.id) === String(paymentTypeId))
		const typeName = String(selectedType?.name || '')
		const isCard = typeName.startsWith('card')
		if (isCard) {
			const digits = cardNumber.replace(/\D/g, '')
			const brand = detectCardBrand(digits)
			if (!isValidCardLength(digits, brand)) return false
		}
		return true
	}, [creating, reservationCode, paymentTypeId, amountSoles, summary, types, cardNumber])

	const cardBrand = useMemo(() => detectCardBrand(cardNumber), [cardNumber])
	const selectedTypeName = useMemo(() => {
		const selected = types.find((t) => String(t.id) === String(paymentTypeId))
		return String(selected?.name || '')
	}, [types, paymentTypeId])
	const isCardPayment = useMemo(() => selectedTypeName.startsWith('card'), [selectedTypeName])

	useEffect(() => {
		if (!payOpen) return
		function onKeyDown(e) {
			if (e.key === 'Escape') setPayOpen(false)
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [payOpen])

	useEffect(() => {
		let cancelled = false
		async function loadSummary() {
			if (!payOpen) return
			const code = reservationCode.trim()
			if (!code) {
				setSummary(null)
				setSummaryError('')
				return
			}
			setSummaryLoading(true)
			setSummaryError('')
			try {
				const result = await api(
					`/api/client/reservations/payment-summary?reservationCode=${encodeURIComponent(code)}`,
				)
				if (cancelled) return
				if (!result.ok) {
					setSummary(null)
					setSummaryError(result.data?.error || 'No se pudo cargar el detalle de la reserva')
					return
				}
				const row = result.data?.summary || null
				setSummary(row)
				const due = Number(row?.due_cents || 0)
				if (due > 0) setAmountSoles(centsToSolesText(due))
				else setAmountSoles('')
			} finally {
				if (!cancelled) setSummaryLoading(false)
			}
		}
		loadSummary()
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [payOpen, reservationCode])

	async function createPayment(e) {
		e?.preventDefault()
		setCreateMsg('')
		setError('')
		setCreating(true)
		try {
			const cents = solesToCents(amountSoles)
			if (!Number.isFinite(cents) || cents <= 0) {
				setError('Ingresa un monto válido en soles')
				return
			}
			if (summary) {
				const due = Number(summary.due_cents || 0)
				if (Number.isFinite(due) && due > 0 && cents !== due) {
					setError('El monto debe ser exactamente el pendiente de pago')
					return
				}
			}
			const payload = {
				reservationCode: reservationCode.trim(),
				paymentTypeId: Number(paymentTypeId),
				amountCents: cents,
				currency: 'PEN',
			}
			const result = await api('/api/client/payments', {
				method: 'POST',
				body: JSON.stringify(payload),
			})
			if (!result.ok) {
				setError(result.data?.error || 'No se pudo registrar el pago')
				return
			}
			setCreateMsg('Pago registrado. Queda pendiente de validación.')
			setReservationCode('')
			setAmountSoles('')
			setCardNumber('')
			setSummary(null)
			setPayOpen(false)
			await refresh()
		} finally {
			setCreating(false)
		}
	}

	if (!me) {
		return (
			<div className="space-y-3">
				<div className="text-sm text-[color:var(--text)]">Inicia sesión para ver tus pagos.</div>
				<button
					onClick={onLogin}
					className="rounded-md bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-[color:var(--on-accent)]"
				>
					Iniciar sesión
				</button>
			</div>
		)
	}

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="text-sm font-semibold text-[color:var(--text-h)]">Mis pagos</div>
				<div className="text-xs text-[color:var(--text)]">
					Total pagado: <span className="font-semibold text-[color:var(--text-h)]">{formatMoney(paidTotal, 'PEN')}</span>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<button
					onClick={() => {
						setCreateMsg('')
						setError('')
						setSummary(null)
						setSummaryError('')
						setPayOpen(true)
					}}
					className="rounded-md bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-[color:var(--on-accent)]"
				>
					Pagar
				</button>
				{createMsg && <div className="text-sm text-[color:var(--text)]">{createMsg}</div>}
			</div>

			{loading && <div className="text-sm text-[color:var(--text)]">Cargando…</div>}
			{error && <div className="text-sm text-red-600">{error}</div>}

			{!loading && !error && items.length === 0 && (
				<div className="text-sm text-[color:var(--text)]">No tienes pagos registrados.</div>
			)}

			{!loading && !error && items.length > 0 && filteredItems.length === 0 && (
				<div className="text-sm text-[color:var(--text)]">Sin resultados.</div>
			)}

			{filteredItems.length > 0 && (
				<div className="overflow-x-auto rounded-md border border-[color:var(--border)]">
					<table className="min-w-full text-left text-sm">
						<thead className="bg-[color:var(--surface-2)] text-xs text-[color:var(--text)]">
							<tr>
								<th className="px-3 py-2 font-medium">ID</th>
								<th className="px-3 py-2 font-medium">Reserva</th>
								<th className="px-3 py-2 font-medium">Tumba</th>
								<th className="px-3 py-2 font-medium">Tipo</th>
								<th className="px-3 py-2 font-medium">Monto</th>
								<th className="px-3 py-2 font-medium">Estado</th>
								<th className="px-3 py-2 font-medium">Fecha</th>
							</tr>
						</thead>
						<tbody>
							{filteredItems.map((p) => (
								<tr key={p.id} className="border-t border-[color:var(--border)]">
									<td className="px-3 py-2 text-[color:var(--text)]">{p.id}</td>
									<td className="px-3 py-2 text-[color:var(--text)]">{p.reservation_code || '—'}</td>
									<td className="px-3 py-2 text-[color:var(--text)]">{p.grave_code || '—'}</td>
									<td className="px-3 py-2 text-[color:var(--text)]">{p.payment_type_name || '—'}</td>
									<td className="px-3 py-2 text-[color:var(--text)]">{formatMoney(p.amount_cents, p.currency)}</td>
									<td className="px-3 py-2 text-[color:var(--text)]">{prettyStatus(p.status)}</td>
									<td className="px-3 py-2 text-[color:var(--text)]">{formatDateTime(p.paid_at || p.created_at)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{payOpen && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center p-4"
					role="dialog"
					aria-modal="true"
					onMouseDown={(e) => {
						if (e.target === e.currentTarget) {
							setPayOpen(false)
							setSummary(null)
							setSummaryError('')
						}
					}}
				>
					<div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
					<div className="relative w-full max-w-lg rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
						<div className="flex items-center justify-between gap-2">
							<div className="text-sm font-semibold text-[color:var(--text-h)]">Registrar pago</div>
							<button
								onClick={() => {
								setPayOpen(false)
								setSummary(null)
								setSummaryError('')
							}}
								className="rounded-md border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
							>
								Cerrar
							</button>
						</div>
						<div className="mt-2 text-xs text-[color:var(--text)]">
							Usa el <span className="font-medium text-[color:var(--text-h)]">código de reserva</span>. Solo puedes pagar cuando la reserva esté confirmada por el administrador.
						</div>

						{summaryLoading && <div className="mt-3 text-sm text-[color:var(--text)]">Cargando detalle…</div>}
						{summaryError && <div className="mt-3 text-sm text-red-600">{summaryError}</div>}
						{summary && (
							<div className="mt-3 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] p-3 text-sm">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="text-xs text-[color:var(--text)]">Reserva</div>
									<div className="text-xs font-medium text-[color:var(--text-h)]">{summary.reservation_code}</div>
								</div>
								<div className="mt-2 grid gap-2 md:grid-cols-2">
									<div className="text-xs text-[color:var(--text)]">
										Estado: <span className="font-medium text-[color:var(--text-h)]">{summary.reservation_status}</span>
									</div>
									<div className="text-xs text-[color:var(--text)]">
										Tumba: <span className="font-medium text-[color:var(--text-h)]">{summary.grave_code || '—'}</span>
									</div>
									<div className="text-xs text-[color:var(--text)]">
										Precio: <span className="font-medium text-[color:var(--text-h)]">{formatMoney(summary.price_cents, summary.currency)}</span>
									</div>
									<div className="text-xs text-[color:var(--text)]">
										Pagado: <span className="font-medium text-[color:var(--text-h)]">{formatMoney(summary.paid_cents, summary.currency)}</span>
									</div>
									<div className="text-xs text-[color:var(--text)]">
										Pendiente validación: <span className="font-medium text-[color:var(--text-h)]">{formatMoney(summary.pending_cents, summary.currency)}</span>
									</div>
									<div className="text-xs text-[color:var(--text)]">
										Te falta pagar:{' '}
										<span className="font-semibold text-[color:var(--text-h)]">{formatMoney(summary.due_cents, summary.currency)}</span>
									</div>
								</div>
								{summary.deceased_full_name ? (
									<div className="mt-2 text-xs text-[color:var(--text)]">
										Difunto: <span className="font-medium text-[color:var(--text-h)]">{summary.deceased_full_name}</span>
									</div>
								) : null}
								{summary.reservation_status !== 'confirmed' && (
									<div className="mt-2 text-xs text-red-600">Esta reserva aún no está confirmada, no puedes pagar todavía.</div>
								)}
							</div>
						)}

						<form onSubmit={createPayment} className="mt-3 space-y-2">
							<div>
								<label className="block text-xs text-[color:var(--text)]">Código de reserva</label>
								<input
									value={reservationCode}
									onChange={(e) => setReservationCode(e.target.value)}
									className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm text-[color:var(--text-h)]"
									placeholder="Ej: RSV-1A2B3C4D"
								/>
							</div>
							<div className="grid gap-2 md:grid-cols-2">
								<div>
									<label className="block text-xs text-[color:var(--text)]">Tipo de pago</label>
									<select
										value={paymentTypeId}
										onChange={(e) => {
											setPaymentTypeId(e.target.value)
											setError('')
											setCreateMsg('')
											setCardNumber('')
										}}
										className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm text-[color:var(--text-h)]"
									>
										{types.length === 0 ? (
											<option value="">Sin tipos</option>
										) : (
											types.map((t) => (
												<option key={t.id} value={String(t.id)}>
													{paymentTypeLabel(t.name)}
												</option>
											))
										)}
									</select>
								</div>
								<div>
									<label className="block text-xs text-[color:var(--text)]">Monto (S/)</label>
									<input
										type="text"
										inputMode="decimal"
										value={amountSoles}
										onChange={(e) => {
											const next = e.target.value
											// Acepta solo dígitos y hasta 2 decimales.
											if (next === '' || /^\d*(?:[.,]\d{0,2})?$/.test(next)) setAmountSoles(next)
										}}
										readOnly={Boolean(summary && Number(summary.due_cents || 0) > 0)}
										className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm text-[color:var(--text-h)]"
										placeholder="Ej: 198.00"
									/>
								</div>
							</div>

							{isCardPayment ? (
								<div>
									<label className="block text-xs text-[color:var(--text)]">Tarjeta</label>
									<input
										value={cardNumber}
										onChange={(e) => {
											const digits = String(e.target.value || '').replace(/\D/g, '')
											const brand = detectCardBrand(digits)
											const maxLen = cardMaxLength(brand)
											setCardNumber(digits.slice(0, maxLen))
										}}
										className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm text-[color:var(--text-h)]"
										placeholder="Número de tarjeta"
										inputMode="numeric"
										autoComplete="cc-number"
										maxLength={cardMaxLength(cardBrand)}
									/>
									<div className="mt-1 text-xs text-[color:var(--text)]">
										Detectado:{' '}
										<span className="font-medium text-[color:var(--text-h)]">{cardBrand || '—'}</span>
									</div>
								</div>
							) : null}

							<button
								disabled={!canCreate}
								className="w-full rounded-md bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-[color:var(--on-accent)] disabled:opacity-50"
							>
								{creating ? 'Registrando…' : 'Registrar pago'}
							</button>
						</form>
					</div>
				</div>
			)}
		</div>
	)
}
