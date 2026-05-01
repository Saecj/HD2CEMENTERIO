import { useMemo } from 'react'
import { Card, StatCard } from '../ui'

export function AdminDashboardModule({ sectors, graves, deceased, employees, reservations, payments }) {
	const gravesByStatus = useMemo(() => {
		const base = { available: 0, reserved: 0, occupied: 0, maintenance: 0 }
		for (const g of graves) {
			if (g?.status && base[g.status] != null) base[g.status] += 1
		}
		return base
	}, [graves])

	const reservationsByStatus = useMemo(() => {
		const base = { pending: 0, confirmed: 0, cancelled: 0, expired: 0 }
		for (const r of reservations) {
			if (r?.status && base[r.status] != null) base[r.status] += 1
		}
		return base
	}, [reservations])

	const paymentsByStatus = useMemo(() => {
		const base = { pending: 0, paid: 0, void: 0 }
		for (const p of payments) {
			if (p?.status && base[p.status] != null) base[p.status] += 1
		}
		return base
	}, [payments])

	const paidTotalPen = useMemo(() => {
		let cents = 0
		for (const p of payments) {
			if (p?.status === 'paid' && p?.currency === 'PEN') cents += Number(p.amount_cents || 0)
		}
		return (cents / 100).toFixed(2)
	}, [payments])

	const recentReservations = useMemo(() => reservations.slice(0, 10), [reservations])
	const recentPayments = useMemo(() => payments.slice(0, 10), [payments])

	return (
		<div className="space-y-3">
			<Card title="Estadísticas">
				<div className="grid gap-3 md:grid-cols-3">
					<StatCard label="Sectores" value={sectors.length} />
					<StatCard
						label="Tumbas"
						value={graves.length}
						hint={`Disponibles: ${gravesByStatus.available} · Reservadas: ${gravesByStatus.reserved} · Ocupadas: ${gravesByStatus.occupied} · Mant.: ${gravesByStatus.maintenance}`}
					/>
					<StatCard label="Difuntos" value={deceased.length} />
					<StatCard label="Empleados" value={employees.length} />
					<StatCard
						label="Reservas"
						value={reservations.length}
						hint={`Pend.: ${reservationsByStatus.pending} · Conf.: ${reservationsByStatus.confirmed} · Canc.: ${reservationsByStatus.cancelled} · Exp.: ${reservationsByStatus.expired}`}
					/>
					<StatCard
						label="Pagos"
						value={payments.length}
						hint={`Pend.: ${paymentsByStatus.pending} · Pagados: ${paymentsByStatus.paid} · Anul.: ${paymentsByStatus.void} · Total pagado PEN: ${paidTotalPen}`}
					/>
				</div>
			</Card>

			<Card title="Reporte rápido">
				<div className="grid gap-3 md:grid-cols-2">
					<div className="rounded-md border border-[color:var(--border)]">
						<div className="border-b border-[color:var(--border)] px-3 py-2 text-xs font-medium text-[color:var(--text)]">
							Últimas reservas
						</div>
						<div className="max-h-64 overflow-auto">
							{recentReservations.length === 0 ? (
								<div className="p-3 text-sm text-[color:var(--text)]">Sin reservas.</div>
							) : (
								recentReservations.map((r) => (
									<div key={r.id} className="border-b border-[color:var(--border)] p-3 last:border-b-0">
										<div className="text-sm font-medium text-[color:var(--text-h)]">#{r.id} · {r.grave_code}</div>
										<div className="text-xs text-[color:var(--text)]">{r.client_email} · {r.status}</div>
									</div>
								))
							)}
						</div>
					</div>

					<div className="rounded-md border border-[color:var(--border)]">
						<div className="border-b border-[color:var(--border)] px-3 py-2 text-xs font-medium text-[color:var(--text)]">
							Últimos pagos
						</div>
						<div className="max-h-64 overflow-auto">
							{recentPayments.length === 0 ? (
								<div className="p-3 text-sm text-[color:var(--text)]">Sin pagos.</div>
							) : (
								recentPayments.map((p) => (
									<div key={p.id} className="border-b border-[color:var(--border)] p-3 last:border-b-0">
										<div className="text-sm font-medium text-[color:var(--text-h)]">
											#{p.id} · {(p.amount_cents / 100).toFixed(2)} {p.currency}
										</div>
										<div className="text-xs text-[color:var(--text)]">{p.client_email} · {p.payment_type_name} · {p.status}</div>
									</div>
								))
							)}
						</div>
					</div>
				</div>
			</Card>
		</div>
	)
}
