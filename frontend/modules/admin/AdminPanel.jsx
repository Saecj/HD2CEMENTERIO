import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

import { SidebarButton } from './ui'

import { AdminDashboardModule } from './modules/AdminDashboardModule'
import { AdminDeceasedModule } from './modules/AdminDeceasedModule'
import { AdminEmployeesModule } from './modules/AdminEmployeesModule'
import { AdminGravesModule } from './modules/AdminGravesModule'
import { AdminPaymentsModule } from './modules/AdminPaymentsModule'
import { AdminReportsModule } from './modules/AdminReportsModule'
import { AdminReservationsModule } from './modules/AdminReservationsModule'

export function AdminPanel({ me }) {
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

	const [activeModule, setActiveModule] = useState(() => safeStorageGet('ui.admin.activeModule') || 'dashboard')
	const [bootLoading, setBootLoading] = useState(true)
	const [bootError, setBootError] = useState('')
	const [lastRefreshAt, setLastRefreshAt] = useState(null)

	const [sectors, setSectors] = useState([])
	const [graveTypes, setGraveTypes] = useState([])
	const [graves, setGraves] = useState([])
	const [employees, setEmployees] = useState([])
	const [deceased, setDeceased] = useState([])
	const [reservations, setReservations] = useState([])
	const [paymentTypes, setPaymentTypes] = useState([])
	const [payments, setPayments] = useState([])

	const perms = Array.isArray(me?.permissions) ? me.permissions : []
	const isAdmin = me?.role === 'admin'
	const canGraves = isAdmin || perms.includes('graves')
	const canDeceased = isAdmin || perms.includes('deceased')
	const canReservations = isAdmin || perms.includes('reservations')
	const canPayments = isAdmin || perms.includes('payments')
	const canReports = isAdmin || perms.includes('reports')
	const canEmployees = isAdmin

	const allowedModules = (() => {
		if (isAdmin) {
			return ['dashboard', 'graves', 'deceased', 'reservations', 'payments', 'employees', 'reports']
		}
		const list = []
		if (canGraves) list.push('graves')
		if (canDeceased) list.push('deceased')
		if (canReservations) list.push('reservations')
		if (canPayments) list.push('payments')
		if (canReports) list.push('reports')
		return list
	})()

	async function refreshAll() {
		const calls = []
		if (isAdmin || canGraves) {
			calls.push(['sectors', api('/api/admin/sectors')])
			calls.push(['graveTypes', api('/api/admin/grave-types')])
			calls.push(['graves', api('/api/admin/graves')])
		}
		if (isAdmin || canEmployees) {
			calls.push(['employees', api('/api/admin/employees')])
		}
		if (isAdmin || canDeceased) {
			calls.push(['deceased', api('/api/admin/deceased')])
		}
		if (isAdmin || canReservations || canReports) {
			calls.push(['reservations', api('/api/admin/reservations')])
		}
		if (isAdmin || canPayments || canReports) {
			calls.push(['paymentTypes', api('/api/admin/payment-types')])
			calls.push(['payments', api('/api/admin/payments')])
		}

		const results = await Promise.all(calls.map((c) => c[1]))
		for (let i = 0; i < calls.length; i++) {
			const key = calls[i][0]
			const r = results[i]
			if (!r?.ok) continue
			if (key === 'sectors') setSectors(Array.isArray(r.data?.sectors) ? r.data.sectors : [])
			if (key === 'graveTypes') setGraveTypes(Array.isArray(r.data?.graveTypes) ? r.data.graveTypes : [])
			if (key === 'graves') setGraves(Array.isArray(r.data?.graves) ? r.data.graves : [])
			if (key === 'employees') setEmployees(Array.isArray(r.data?.employees) ? r.data.employees : [])
			if (key === 'deceased') setDeceased(Array.isArray(r.data?.deceased) ? r.data.deceased : [])
			if (key === 'reservations') setReservations(Array.isArray(r.data?.reservations) ? r.data.reservations : [])
			if (key === 'paymentTypes') setPaymentTypes(Array.isArray(r.data?.paymentTypes) ? r.data.paymentTypes : [])
			if (key === 'payments') setPayments(Array.isArray(r.data?.payments) ? r.data.payments : [])
		}

		setLastRefreshAt(new Date())
	}

	useEffect(() => {
		safeStorageSet('ui.admin.activeModule', activeModule)
	}, [activeModule])

	useEffect(() => {
		// Si el usuario no tiene permiso para el módulo activo, cae al primero permitido.
		if (!allowedModules.length) return
		if (!allowedModules.includes(activeModule)) {
			setActiveModule(allowedModules[0])
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [me?.role, me?.permissions])

	useEffect(() => {
		;(async () => {
			setBootLoading(true)
			setBootError('')
			try {
				await refreshAll()
			} catch {
				setBootError('No se pudo cargar el panel de administración')
			} finally {
				setBootLoading(false)
			}
		})()
	}, [])

	async function onManualRefresh() {
		setBootLoading(true)
		setBootError('')
		try {
			await refreshAll()
		} catch {
			setBootError('No se pudo actualizar el panel de administración')
		} finally {
			setBootLoading(false)
		}
	}

	return (
		<div className="mt-8">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 className="text-sm font-semibold text-[color:var(--text-h)]">Administrador</h2>
					<div className="mt-1 text-xs text-[color:var(--text)]">
						{lastRefreshAt ? `Actualizado: ${lastRefreshAt.toLocaleString()}` : '—'}
					</div>
				</div>
				<button
					onClick={onManualRefresh}
					disabled={bootLoading}
					className="rounded-md border border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--text-h)] hover:bg-[color:var(--hover)] transition-colors disabled:opacity-50"
				>
					Actualizar
				</button>
			</div>

			{bootLoading && <p className="mt-3 text-sm text-[color:var(--text)]">Cargando…</p>}
			{bootError && <p className="mt-3 text-sm text-red-600">{bootError}</p>}

			{!bootLoading && !bootError && (
				<div className="mt-4 flex flex-col gap-3 md:flex-row">
					<aside className="rounded-md border border-[color:var(--border)] p-2 md:w-60">
						<div className="px-2 py-2 text-xs font-medium text-[color:var(--text)]">Módulos</div>
						<div className="space-y-1">
							{(isAdmin ? true : false) && (
								<SidebarButton active={activeModule === 'dashboard'} onClick={() => setActiveModule('dashboard')}>
									Inicio (estadísticas)
								</SidebarButton>
							)}
							{canGraves && (
								<SidebarButton active={activeModule === 'graves'} onClick={() => setActiveModule('graves')}>
									Gestionar tumbas
								</SidebarButton>
							)}
							{canDeceased && (
								<SidebarButton active={activeModule === 'deceased'} onClick={() => setActiveModule('deceased')}>
									Gestionar difuntos
								</SidebarButton>
							)}
							{canReservations && (
								<SidebarButton active={activeModule === 'reservations'} onClick={() => setActiveModule('reservations')}>
									Gestionar reservas
								</SidebarButton>
							)}
							{canPayments && (
								<SidebarButton active={activeModule === 'payments'} onClick={() => setActiveModule('payments')}>
									Gestionar pagos
								</SidebarButton>
							)}
							{canEmployees && (
								<SidebarButton active={activeModule === 'employees'} onClick={() => setActiveModule('employees')}>
									Gestionar empleados
								</SidebarButton>
							)}
							{canReports && (
								<SidebarButton active={activeModule === 'reports'} onClick={() => setActiveModule('reports')}>
									Reporte
								</SidebarButton>
							)}
						</div>
					</aside>

					<section className="flex-1">
						{activeModule === 'dashboard' && isAdmin && (
							<AdminDashboardModule
								sectors={sectors}
								graves={graves}
								deceased={deceased}
								employees={employees}
								reservations={reservations}
								payments={payments}
							/>
						)}

						{activeModule === 'graves' && canGraves && (
							<AdminGravesModule sectors={sectors} graveTypes={graveTypes} graves={graves} onRefresh={refreshAll} />
						)}

						{activeModule === 'deceased' && canDeceased && (
							<AdminDeceasedModule deceased={deceased} reservations={reservations} graves={graves} onRefresh={refreshAll} />
						)}

						{activeModule === 'reservations' && canReservations && (
							<AdminReservationsModule reservations={reservations} graves={graves} onRefresh={refreshAll} />
						)}

						{activeModule === 'payments' && canPayments && (
							<AdminPaymentsModule payments={payments} paymentTypes={paymentTypes} onRefresh={refreshAll} />
						)}

						{activeModule === 'employees' && canEmployees && (
							<AdminEmployeesModule employees={employees} onRefresh={refreshAll} />
						)}

						{activeModule === 'reports' && canReports && (
							<AdminReportsModule reservations={reservations} payments={payments} onRefresh={refreshAll} />
						)}

						{!isAdmin && allowedModules.length === 0 && (
							<div className="rounded-md border border-[color:var(--border)] p-3 text-sm text-[color:var(--text)]">
								No tienes permisos asignados. Pídele a un administrador que te habilite módulos.
							</div>
						)}
					</section>
				</div>
			)}
		</div>
	)
}
