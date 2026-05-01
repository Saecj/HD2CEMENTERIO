import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import graveCardImg from '../../assets/tumba_disponible.webp'
import mausoleoImg from '../../assets/mausoleo_gotico.webp'
import { Panel } from '../layout/Panel'

function formatMoney(cents, currency = 'PEN') {
	const amount = Number(cents || 0) / 100
	try {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
	} catch {
		return `${amount.toFixed(2)} ${currency}`
	}
}

export function HomeView({
	me,
	onLogin,
	onGoToMyReservations,
	onGoToSearch,
	onGoToGraveStatus,
	onGoToPayments,
	onPayReservation: _onPayReservation,
}) {
	const [available, setAvailable] = useState([])
	const [loading, setLoading] = useState(false)
	const [msg, setMsg] = useState('')
	const [error, setError] = useState('')
	const [lastReservation, setLastReservation] = useState(null)

	function formatReservationStatus(s) {
		const v = String(s || '').toLowerCase()
		if (v === 'confirmed') return 'Confirmada'
		if (v === 'pending') return 'Pendiente'
		if (!v) return 'Pendiente'
		return v
	}

	const [creatingId, setCreatingId] = useState(null)
	const [reserveOpen, setReserveOpen] = useState(false)
	const [reserveStep, setReserveStep] = useState(1)

	const [mapSectors, setMapSectors] = useState([])
	const [mapSectorId, setMapSectorId] = useState(null)
	const [mapGraves, setMapGraves] = useState([])
	const [mapLoading, setMapLoading] = useState(false)
	const [mapError, setMapError] = useState('')

	const [deceasedFirstName, setDeceasedFirstName] = useState('')
	const [deceasedLastName, setDeceasedLastName] = useState('')
	const [reservedFrom, setReservedFrom] = useState('')
	const [reservedTo, setReservedTo] = useState('')
	const [reserveFormError, setReserveFormError] = useState('')
	const [selectedGraveId, setSelectedGraveId] = useState(null)
	const [selectedGraveTypeId, setSelectedGraveTypeId] = useState(null)

	const selectedGrave = useMemo(() => {
		if (!selectedGraveId) return null
		return mapGraves.find((g) => g.id === selectedGraveId) || null
	}, [mapGraves, selectedGraveId])

	function getSectorShortName(name) {
		const s = String(name || '').trim()
		if (!s) return '—'
		return s.length <= 2 ? s : s.slice(0, 2)
	}

	function computeCellState(g) {
		if (!g) return 'maintenance'
		if (g.has_burial || g.grave_status === 'occupied') return 'occupied'
		if (g.active_reservation_status === 'confirmed' || g.grave_status === 'reserved') return 'confirmed'
		if (g.active_reservation_status === 'pending') return 'pending'
		if (g.grave_status === 'maintenance' || g.is_enabled === false) return 'maintenance'
		return 'available'
	}

	function getTypeSubtitle(name) {
		const n = String(name || '')
			.trim()
			.toLowerCase()
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
		if (!n) return ''
		if (n.includes('estandar') || n.includes('estándar')) return 'Individual · Mantenimiento básico'
		if (n.includes('premium')) return 'Individual · Jardín + flores mensuales'
		if (n.includes('familiar')) return 'Hasta 4 personas · Mausoleo'
		if (n.includes('columbario')) return 'Nicho para urnas · Cremación'
		return ''
	}

	const typeCards = useMemo(() => {
		// Agrupa tipos existentes en el sector, usando precio mínimo disponible por tipo
		const byId = new Map()
		for (const g of mapGraves) {
			const typeId = g?.grave_type_id
			if (typeId == null) continue
			const key = String(typeId)
			const state = computeCellState(g)
			const isAvailable = state === 'available'
			const price = Number(g?.price_cents ?? 0)
			const prev = byId.get(key)
			if (!prev) {
				byId.set(key, {
					id: key,
					name: g?.grave_type_name || '—',
					minAvailablePriceCents: isAvailable ? (Number.isFinite(price) ? price : null) : null,
					availableCount: isAvailable ? 1 : 0,
				})
				continue
			}
			prev.availableCount += isAvailable ? 1 : 0
			if (isAvailable && Number.isFinite(price)) {
				if (prev.minAvailablePriceCents == null || price < prev.minAvailablePriceCents) {
					prev.minAvailablePriceCents = price
				}
			}
		}
		return Array.from(byId.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)))
	}, [mapGraves])

	const mapCols = useMemo(() => {
		const cols = mapGraves.map((g) => g.col_number).filter((n) => Number.isFinite(n))
		const max = cols.length ? Math.max(...cols) : 0
		return Math.max(max, 0)
	}, [mapGraves])

	function displayCellNumber(g) {
		const r = Number(g?.row_number)
		const c = Number(g?.col_number)
		if (!Number.isFinite(r) || !Number.isFinite(c) || !Number.isFinite(mapCols) || mapCols <= 0) return ''
		return String((r - 1) * mapCols + c)
	}

	async function loadAvailable() {
		setLoading(true)
		setError('')
		try {
			const result = await api('/api/client/available-graves')
			if (!result.ok) {
				setError(result.data?.error || 'No se pudieron cargar las tumbas disponibles')
				setAvailable([])
				return
			}
			setAvailable(Array.isArray(result.data?.graves) ? result.data.graves : [])
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		let cancelled = false
		async function load() {
			setLoading(true)
			setError('')
			try {
				const result = await api('/api/client/available-graves')
				if (!result.ok) {
					if (!cancelled) setError(result.data?.error || 'No se pudieron cargar las tumbas disponibles')
					if (!cancelled) setAvailable([])
					return
				}
				if (!cancelled) setAvailable(Array.isArray(result.data?.graves) ? result.data.graves : [])
			} finally {
				if (!cancelled) setLoading(false)
			}
		}
		load()
		return () => {
			cancelled = true
		}
	}, [])

	async function loadGraveMap(nextSectorId) {
		setMapLoading(true)
		setMapError('')
		try {
			const qs = nextSectorId ? `?sectorId=${encodeURIComponent(String(nextSectorId))}` : ''
			const result = await api(`/api/client/grave-map${qs}`)
			if (!result.ok) {
				setMapError(result.data?.error || 'No se pudo cargar el mapa de tumbas')
				setMapSectors([])
				setMapSectorId(null)
				setMapGraves([])
				return
			}
			const sectors = Array.isArray(result.data?.sectors) ? result.data.sectors : []
			const sectorId = result.data?.sectorId ?? null
			const graves = Array.isArray(result.data?.graves) ? result.data.graves : []
			setMapSectors(sectors)
			setMapSectorId(sectorId)
			setMapGraves(graves)
		} finally {
			setMapLoading(false)
		}
	}

	async function openReserveModal(prefillGrave) {
		setMsg('')
		setError('')
		setReserveFormError('')
		setReserveStep(1)
		setReserveOpen(true)
		setSelectedGraveId(prefillGrave?.id ?? null)
		setSelectedGraveTypeId(null)

		// Carga inicial del mapa
		await loadGraveMap(mapSectorId)

		// Si venimos desde una tarjeta, intentamos cambiar al sector correcto por nombre
		if (prefillGrave?.sector_name && Array.isArray(mapSectors) && mapSectors.length > 0) {
			const match = mapSectors.find((s) => String(s.name || '').trim() === String(prefillGrave.sector_name || '').trim())
			if (match && String(match.id) !== String(mapSectorId)) {
				setMapSectorId(match.id)
				setSelectedGraveId(null)
				await loadGraveMap(match.id)
				setSelectedGraveId(prefillGrave?.id ?? null)
			}
		}
	}

	const canReserve = useMemo(() => {
		const full = `${String(deceasedFirstName || '').trim()} ${String(deceasedLastName || '').trim()}`.trim()
		return !!selectedGraveId && !!full && creatingId == null
	}, [creatingId, deceasedFirstName, deceasedLastName, selectedGraveId])

	const confirmHint = useMemo(() => {
		if (creatingId != null) return ''
		if (!me) return 'Inicia sesión para confirmar la reserva.'
		const full = `${String(deceasedFirstName || '').trim()} ${String(deceasedLastName || '').trim()}`.trim()
		if (!full) return 'Completa nombre y apellido del difunto.'
		if (!selectedGraveId) return 'Selecciona una parcela disponible en el mapa.'
		return ''
	}, [creatingId, deceasedFirstName, deceasedLastName, me, selectedGraveId])

	async function submitReserve(e) {
		e?.preventDefault?.()
		setMsg('')
		setError('')
		setReserveFormError('')

		if (!me) {
			setReserveFormError('Inicia sesión para reservar.')
			onLogin?.()
			return
		}

		if (!selectedGraveId) {
			setReserveFormError('Selecciona una parcela en el mapa')
			setReserveStep(2)
			return
		}

		const deceasedFullName = `${String(deceasedFirstName || '').trim()} ${String(deceasedLastName || '').trim()}`.trim()
		if (!deceasedFullName) {
			setReserveFormError('Ingresa el nombre y apellido del difunto')
			setReserveStep(1)
			return
		}

		if (reservedFrom && reservedTo) {
			try {
				if (new Date(reservedFrom).getTime() > new Date(reservedTo).getTime()) {
					setReserveFormError('La fecha “Desde” no puede ser mayor que “Hasta”')
					return
				}
			} catch {
				// ignoramos parse errors y dejamos que backend valide si hace falta
			}
		}

		const snapshot = {
			grave: selectedGrave
				? {
					id: selectedGrave.id,
					code: selectedGrave.code,
					sector_name: selectedGrave.sector_name,
					row_number: selectedGrave.row_number,
					col_number: selectedGrave.col_number,
					price_cents: selectedGrave.price_cents,
				}
				: null,
			deceasedFullName: deceasedFullName,
			reservedFrom: reservedFrom || null,
			reservedTo: reservedTo || null,
		}

		setCreatingId(selectedGraveId)
		try {
			const result = await api('/api/client/reservations', {
				method: 'POST',
				body: JSON.stringify({
					graveId: selectedGraveId,
					deceasedFullName,
					reservedFrom: reservedFrom || null,
					reservedTo: reservedTo || null,
				}),
			})
			if (!result.ok) {
				setError(result.data?.error || 'No se pudo crear la reserva')
				return
			}

			const code = result.data?.reservation?.reservation_code
			setLastReservation({
				code: code || null,
				status: result.data?.reservation?.status || 'pending',
				grave: snapshot.grave,
				deceasedFullName: snapshot.deceasedFullName,
				reservedFrom: snapshot.reservedFrom,
				reservedTo: snapshot.reservedTo,
			})
			setMsg(code ? `Reserva creada (${code}) — queda pendiente de aprobación.` : 'Reserva creada — queda pendiente de aprobación.')
			try {
				// Te manda al inicio para que veas el resumen de la reserva.
				window.scrollTo({ top: 0, behavior: 'smooth' })
			} catch {
				// ignore
			}
			setReserveOpen(false)
			setSelectedGraveId(null)
			await loadAvailable()
			await loadGraveMap(mapSectorId)
		} finally {
			setCreatingId(null)
		}
	}

	return (
		<div className="space-y-6">
			{/* Cabecera unificada con Navbar (full-bleed) */}
			<header
				className="theme-dark -mx-4 -mt-6 overflow-hidden border-b border-[color:var(--border)]"
				style={{ background: 'var(--nav-gradient)' }}
			>
				<div className="relative">
					<img
						src={mausoleoImg}
						alt=""
						className="h-40 w-full object-cover opacity-30 md:h-44"
						loading="lazy"
					/>
					<div className="absolute inset-0 bg-black/35" aria-hidden="true" />

					<div className="relative mx-auto max-w-6xl px-4 py-6">
						<div className="grid gap-4 md:grid-cols-[1fr_380px] md:items-end">
							<div>
								<div className="text-[11px] tracking-[0.18em] uppercase text-white/80">Inicio</div>
								<div className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--text-h)] md:text-3xl">
									Reserva y seguimiento
								</div>
								<div className="mt-2 text-sm text-[color:var(--text)]">
									Reserva una tumba, busca un difunto, revisa el estado de la parcela y gestiona tus reservas y pagos.
								</div>
							</div>

							<div className="rounded-xl border border-white/15 bg-white/10 p-4 text-left text-white backdrop-blur">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="text-sm font-semibold">Accesos rápidos</div>
									<div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
										{loading ? '—' : `${available.length} disponibles`}
									</div>
								</div>
								<div className="mt-3 grid gap-2 sm:grid-cols-2">
									<button
										type="button"
										onClick={() => openReserveModal(null)}
										className="h-10 rounded-md bg-[color:var(--accent)] px-3 text-sm font-semibold text-[color:var(--on-accent)] ring-1 ring-[color:var(--accent-border)] shadow-[var(--shadow)]"
									>
										Reservar tumba
									</button>
									<button
										type="button"
										onClick={() => (me ? onGoToMyReservations?.() : onLogin?.())}
										className="h-10 rounded-md border border-white/20 bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/15"
									>
										{me ? 'Ver mis reservas' : 'Iniciar sesión'}
									</button>
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									<button
										type="button"
										onClick={() => onGoToSearch?.()}
										className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
									>
										Buscar difunto
									</button>
									<button
										type="button"
										onClick={() => onGoToGraveStatus?.()}
										className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
									>
										Ver estado
									</button>
									<button
										type="button"
										onClick={() => onGoToMyReservations?.()}
										className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
									>
										Reservas
									</button>
									<button
										type="button"
										onClick={() => onGoToPayments?.()}
										className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
									>
										Pagos
									</button>
								</div>
								{lastReservation?.code ? (
									<div className="mt-3 text-xs text-white/80">
										Última reserva: <span className="font-semibold text-white">{lastReservation.code}</span> · {formatReservationStatus(lastReservation.status)}
									</div>
								) : null}
							</div>
						</div>
					</div>
				</div>
			</header>

			<Panel className="p-0 overflow-hidden">
				<div className="p-4">
					{lastReservation ? (
						<div className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-3 text-sm text-[color:var(--text)]">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div className="text-sm font-semibold text-[color:var(--text-h)]">
									Tu reserva {lastReservation.code ? `(${lastReservation.code})` : ''}
								</div>
								<button
									type="button"
									onClick={() => {
										setLastReservation(null)
										setMsg('')
									}}
									className="rounded-md border border-[color:var(--border)] bg-transparent px-2 py-1 text-xs text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
								>
									Ocultar
								</button>
							</div>
							<div className="mt-1 text-xs text-[color:var(--muted)]">Estado actual: {formatReservationStatus(lastReservation.status)}</div>
							<div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
								<div>
									<div className="text-[color:var(--muted)]">Difunto</div>
									<div className="font-medium text-[color:var(--text-h)]">{lastReservation.deceasedFullName || '—'}</div>
								</div>
								<div>
									<div className="text-[color:var(--muted)]">Desde</div>
									<div className="font-medium text-[color:var(--text-h)]">{lastReservation.reservedFrom || '—'}</div>
								</div>
								<div>
									<div className="text-[color:var(--muted)]">Hasta</div>
									<div className="font-medium text-[color:var(--text-h)]">{lastReservation.reservedTo || '—'}</div>
								</div>
							</div>
							{lastReservation.grave ? (
								<div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
									<div>
										<div className="text-[color:var(--muted)]">Tumba</div>
										<div className="font-medium text-[color:var(--text-h)]">{lastReservation.grave.code || '—'}</div>
									</div>
									<div>
										<div className="text-[color:var(--muted)]">Sección</div>
										<div className="font-medium text-[color:var(--text-h)]">{lastReservation.grave.sector_name || '—'}</div>
									</div>
									<div>
										<div className="text-[color:var(--muted)]">Ubicación</div>
										<div className="font-medium text-[color:var(--text-h)]">
											Fila {lastReservation.grave.row_number ?? '—'} · Col {lastReservation.grave.col_number ?? '—'}
										</div>
									</div>
								</div>
							) : null}
							<div className="mt-3 flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={() => onGoToMyReservations?.()}
									className="rounded-md bg-[color:var(--accent)] px-3 py-2 text-xs font-medium text-[color:var(--on-accent)]"
								>
									Ir a Mis reservas
								</button>
								<div className="text-xs text-[color:var(--muted)]">Ahí podrás ver si ya fue confirmada.</div>
							</div>
						</div>
					) : null}
					{msg && <div className="mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-2 text-sm text-[color:var(--text)]">{msg}</div>}
					{error && <div className="mb-3 text-sm text-red-600">{error}</div>}

					<div className="flex items-center justify-between gap-3">
						<div>
							<div className="ui-title text-base font-semibold md:text-lg">Tumbas disponibles</div>
							<div className="mt-1 text-xs text-[color:var(--muted)]">También puedes reservar desde el mapa por sector.</div>
						</div>
						<div className="ui-chip">{available.length} disponibles</div>
					</div>

					{loading && <div className="mt-4 text-sm text-[color:var(--text)]">Cargando…</div>}
					{!loading && available.length === 0 && (
						<div className="mt-4 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-3 text-sm text-[color:var(--text)]">
							No hay tumbas disponibles por ahora.
						</div>
					)}

					{!loading && available.length > 0 && (
						<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{available.map((g) => (
								<div key={g.id} className="ui-card ui-card--grave overflow-hidden group">
									<div className="relative">
										<img
											src={graveCardImg}
											alt="Tumba disponible"
											className="h-60 w-full object-cover opacity-90 transition duration-300 group-hover:opacity-100 md:h-64"
											loading="lazy"
										/>
										<div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
									</div>

									<div className="p-3 md:p-4">
										<div className="flex items-center justify-between gap-2">
											<div className="text-xl font-semibold tracking-tight text-[color:var(--text-h)]">{g.code}</div>
											<div className="ui-chip" style={{ padding: '5px 10px', fontSize: 12 }}>
												{formatMoney(g.price_cents, 'PEN')}
											</div>
										</div>

										<div className="mt-3 grid grid-cols-3 gap-2 text-[12px] text-[color:var(--text)]">
											<div>
												<div className="font-semibold tracking-wide text-[color:var(--muted)]">Sección</div>
												<div className="mt-0.5 text-sm font-semibold text-[color:var(--text-h)]">{g.sector_name || '—'}</div>
											</div>
											<div>
												<div className="font-semibold tracking-wide text-[color:var(--muted)]">Fila</div>
												<div className="mt-0.5 text-sm font-semibold text-[color:var(--text-h)]">{g.row_number ?? '—'}</div>
											</div>
											<div>
												<div className="font-semibold tracking-wide text-[color:var(--muted)]">Col</div>
												<div className="mt-0.5 text-sm font-semibold text-[color:var(--text-h)]">{g.col_number ?? '—'}</div>
											</div>
										</div>

										<button
											type="button"
											onClick={() => openReserveModal(g)}
											className="mt-4 w-full rounded-lg bg-[color:var(--accent)] px-3 py-2.5 text-xs font-semibold text-[color:var(--on-accent)]"
										>
											{me ? 'Reservar desde mapa' : 'Ver en mapa'}
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</Panel>

			{reserveOpen && (
				<div
					className="fixed inset-0 z-50 overflow-y-auto p-4"
					role="dialog"
					aria-modal="true"
					onMouseDown={(e) => {
						if (e.target === e.currentTarget) setReserveOpen(false)
					}}
				>
					<div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
					<div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
						<div className="px-4 py-4" style={{ background: 'var(--hero-gradient)' }}>
							<div className="flex items-start justify-between gap-3">
								<div>
									<div className="text-sm font-semibold text-white">Reservar una parcela</div>
									<div className="mt-1 text-xs text-white/75">Completa los pasos para asegurar tu lugar</div>
								</div>
								<button
									onClick={() => setReserveOpen(false)}
									className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/15"
								>
									Cerrar
								</button>
							</div>

							<div className="mt-3 flex items-center gap-2 text-xs text-white/90">
								<button
									type="button"
									onClick={() => setReserveStep(1)}
									className={
										'rounded-full px-3 py-1 transition ' +
										(reserveStep === 1
											? 'bg-white text-[color:var(--az2)]'
											: 'bg-white/15 text-white/80 hover:bg-white/20')
									}
								>
									1 · Datos
								</button>
								<button
									type="button"
									onClick={() => setReserveStep(2)}
									className={
										'rounded-full px-3 py-1 transition ' +
										(reserveStep === 2
											? 'bg-white text-[color:var(--az2)]'
											: 'bg-white/15 text-white/80 hover:bg-white/20')
									}
								>
									2 · Parcela
								</button>
								<button
									type="button"
									onClick={() => setReserveStep(3)}
									className={
										'rounded-full px-3 py-1 transition ' +
										(reserveStep === 3
											? 'bg-white text-[color:var(--az2)]'
											: 'bg-white/15 text-white/80 hover:bg-white/20')
									}
								>
									3 · Confirmar
								</button>
							</div>
						</div>

						<div
							className="grid gap-4 overflow-y-auto p-4 md:grid-cols-[1fr_360px] md:items-start"
							style={{ maxHeight: 'calc(100vh - 2rem - 98px)' }}
						>
							<div className="space-y-3">
								<div className="ui-card ui-card--tight">
									<div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-h)]">
										<span className="inline-block h-2 w-2 rounded-full bg-[color:var(--accent)]" />
										Datos del difunto
									</div>
									<form onSubmit={submitReserve} className="mt-3 space-y-3">
										<div className="grid gap-2 md:grid-cols-2">
											<div>
												<label className="block text-xs text-[color:var(--text)]">Nombre</label>
												<input
													value={deceasedFirstName}
													onChange={(e) => setDeceasedFirstName(e.target.value)}
													className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm text-[color:var(--text-h)]"
													placeholder="Ej: Juan"
													autoFocus
												/>
											</div>
											<div>
												<label className="block text-xs text-[color:var(--text)]">Apellido</label>
												<input
													value={deceasedLastName}
													onChange={(e) => setDeceasedLastName(e.target.value)}
													className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm text-[color:var(--text-h)]"
													placeholder="Ej: Pérez"
												/>
											</div>
										</div>
										<div className="grid gap-2 md:grid-cols-2">
											<div>
												<label className="block text-xs text-[color:var(--text)]">Desde (opcional)</label>
												<input
													type="date"
													value={reservedFrom}
													onChange={(e) => setReservedFrom(e.target.value)}
													className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm text-[color:var(--text-h)]"
												/>
											</div>
											<div>
												<label className="block text-xs text-[color:var(--text)]">Hasta (opcional)</label>
												<input
													type="date"
													value={reservedTo}
													onChange={(e) => setReservedTo(e.target.value)}
													className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm text-[color:var(--text-h)]"
												/>
											</div>
										</div>
									</form>
								</div>

								<div className="ui-card ui-card--tight">
									<div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-h)]">
										<span className="inline-block h-2 w-2 rounded-full bg-[color:var(--accent)]" />
										Selecciona el sector
									</div>
									<div className="mt-3 ui-sector-grid">
										{mapSectors.map((s) => (
											<button
												type="button"
												key={s.id}
												data-active={String(mapSectorId) === String(s.id) ? 'true' : 'false'}
												className="ui-sector-btn"
												onClick={async () => {
													setMapSectorId(s.id)
													setSelectedGraveId(null)
													await loadGraveMap(s.id)
													setReserveStep(2)
												}}
											>
												<span className="ui-sector-btn__code">{getSectorShortName(s.name)}</span>
												<span className="ui-sector-btn__label">{s.name}</span>
											</button>
										))}
									</div>

									<div className="mt-4">
											<div className="text-xs text-[color:var(--muted)]">Tipo de parcela</div>
											{typeCards.length === 0 ? (
												<div className="mt-2 text-sm text-[color:var(--text)]">No hay tipos configurados en este sector.</div>
											) : (
												<div className="mt-2 grid gap-2 sm:grid-cols-2">
													{typeCards.map((t) => {
														const active = String(selectedGraveTypeId || '') === String(t.id)
														const disabled = t.availableCount <= 0
														const subtitle = getTypeSubtitle(t.name)
														return (
															<button
																key={t.id}
																type="button"
																disabled={disabled}
																onClick={() => {
																	setSelectedGraveTypeId(t.id)
																	setSelectedGraveId(null)
																	setReserveFormError('')
																	setReserveStep(2)
																}}
																className={
																	'w-full rounded-xl border px-3 py-3 text-left transition ' +
																	(active
																		? 'border-[color:var(--accent)] bg-[color:var(--surface-2)]'
																		: 'border-[color:var(--border)] bg-transparent hover:bg-[color:var(--surface-2)]') +
																	(disabled ? ' opacity-50' : '')
																}
															>
																<div className="flex items-start justify-between gap-2">
																	<div className="text-sm font-semibold text-[color:var(--text-h)]">{t.name}</div>
																	<div className="text-sm font-semibold text-[color:var(--text-h)]">
																		{t.minAvailablePriceCents != null ? formatMoney(t.minAvailablePriceCents, 'PEN') : '—'}
																	</div>
																</div>
																{subtitle && <div className="mt-1 text-xs text-[color:var(--muted)]">{subtitle}</div>}
																{!subtitle && <div className="mt-1 text-xs text-[color:var(--muted)]">{t.availableCount} disponibles</div>}
															</button>
														)
												})}
												</div>
											)}

										<div className="text-xs text-[color:var(--muted)]">Mapa del sector — haz clic para seleccionar</div>
										{mapLoading && <div className="mt-2 text-sm text-[color:var(--text)]">Cargando mapa…</div>}
										{mapError && <div className="mt-2 text-sm text-red-600">{mapError}</div>}
										{!mapLoading && !mapError && (
												<div className="mt-3 overflow-x-auto pb-2">
													<div
														className="ui-grave-grid"
														style={{ gridTemplateColumns: `repeat(${Math.max(mapCols || 6, 1)}, var(--cell-w))` }}
													>
													{mapGraves.map((g) => {
														const state = computeCellState(g)
																const typeOk =
																	selectedGraveTypeId == null || String(g.grave_type_id || '') === String(selectedGraveTypeId)
																const selectable = state === 'available' && typeOk
														const isSelected = selectedGraveId === g.id
														return (
															<button
																key={g.id}
																type="button"
																className="ui-grave-cell"
																data-state={state}
																data-selected={isSelected ? 'true' : 'false'}
																disabled={!selectable}
																title={g.code}
																	onClick={() => {
																		if (!selectable) return
																		setSelectedGraveId(g.id)
																		if (g.grave_type_id != null) setSelectedGraveTypeId(String(g.grave_type_id))
																		setReserveStep(3)
																	}}
															>
																{displayCellNumber(g) || '•'}
															</button>
														)
													})}
													</div>

												<div className="ui-grave-legend">
													<div className="ui-grave-legend__item">
														<span
															className="ui-grave-legend__swatch"
															style={{ background: 'color-mix(in oklab, var(--az4) 16%, var(--surface))' }}
														/>
														Disponible
													</div>
													<div className="ui-grave-legend__item">
														<span
															className="ui-grave-legend__swatch"
															style={{ background: 'color-mix(in oklab, var(--az4) 22%, var(--surface))' }}
														/>
														Pendiente
													</div>
													<div className="ui-grave-legend__item">
														<span
															className="ui-grave-legend__swatch"
															style={{ background: 'color-mix(in oklab, var(--az3) 85%, var(--surface))' }}
														/>
														Confirmada
													</div>
													<div className="ui-grave-legend__item">
														<span
															className="ui-grave-legend__swatch"
															style={{ background: 'color-mix(in oklab, var(--az1) 92%, var(--surface))' }}
														/>
														Ocupada
													</div>
													<div className="ui-grave-legend__item">
														<span
															className="ui-grave-legend__swatch"
															style={{ background: 'color-mix(in oklab, var(--az2) 42%, var(--surface))' }}
														/>
														Seleccionada
													</div>
												</div>
												<div className="mt-2 text-xs text-[color:var(--text)]">
													<span className="text-[color:var(--muted)]">Seleccionada:</span>{' '}
													<span className="font-medium text-[color:var(--text-h)]">{selectedGrave?.code || '—'}</span>
												</div>
											</div>
										)}
									</div>
								</div>
							</div>

							<div className="ui-card overflow-hidden p-0">
							<div className="px-4 py-3" style={{ background: 'linear-gradient(90deg, var(--az1), var(--az2))' }}>
								<div className="text-sm font-semibold text-white">Resumen de reserva</div>
							</div>
							<div className="p-4">
																<div className="flex items-center justify-between py-2 text-sm">
																	<span className="text-[color:var(--muted)]">Titular</span>
																	<span className="font-medium text-[color:var(--text-h)]">{me?.email || '—'}</span>
																</div>
								<div className="flex items-center justify-between border-t border-[color:var(--border)] py-2 text-sm">
									<span className="text-[color:var(--muted)]">Sector</span>
									<span className="font-medium text-[color:var(--text-h)]">
										{selectedGrave?.sector_name || mapSectors.find((s) => String(s.id) === String(mapSectorId))?.name || '—'}
									</span>
								</div>
								<div className="flex items-center justify-between border-t border-[color:var(--border)] py-2 text-sm">
									<span className="text-[color:var(--muted)]">Parcela</span>
									<span className="font-medium text-[color:var(--text-h)]">{selectedGrave ? selectedGrave.code : '— seleccionar'}</span>
								</div>
								<div className="flex items-center justify-between border-t border-[color:var(--border)] py-2 text-sm">
									<span className="text-[color:var(--muted)]">Tipo</span>
									<span className="font-medium text-[color:var(--text-h)]">{selectedGrave?.grave_type_name || '—'}</span>
								</div>
								<div className="mt-3 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-3">
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium text-[color:var(--text)]">Total estimado</span>
										<span className="text-lg font-semibold text-[color:var(--text-h)]">{formatMoney(selectedGrave?.price_cents || 0, 'PEN')}</span>
									</div>
									<div className="mt-1 text-xs text-[color:var(--muted)]">Se crea como pendiente hasta aprobación del administrador.</div>
								</div>

								{reserveFormError && <div className="mt-3 text-sm text-red-600">{reserveFormError}</div>}
								{error && <div className="mt-2 text-sm text-red-600">{error}</div>}

																<button
																	onClick={(e) => submitReserve(e)}
																	disabled={!canReserve}
																	className="mt-3 w-full rounded-md bg-[color:var(--accent)] px-3 py-3 text-sm font-medium text-[color:var(--on-accent)] disabled:opacity-50"
																	type="button"
																>
																	{creatingId != null ? 'Reservando…' : me ? 'Confirmar reserva' : 'Iniciar sesión para reservar'}
																</button>
								{!canReserve && confirmHint && <div className="mt-2 text-xs text-[color:var(--muted)]">{confirmHint}</div>}
							</div>
						</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
