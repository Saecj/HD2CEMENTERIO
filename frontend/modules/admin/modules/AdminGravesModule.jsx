import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { Card, formatMoney, normalizeNumber } from '../ui'

export function AdminGravesModule({ sectors, graveTypes, graves, onRefresh }) {
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

	function graveStatusUi(status) {
		switch (status) {
			case 'occupied':
				return { label: 'Ocupada', className: 'bg-[color:var(--az1)] text-white border-[color:var(--az1)]', dot: 'bg-[color:var(--az1)]' }
			case 'reserved':
				return { label: 'Reservada', className: 'bg-[color:var(--az3)] text-white border-[color:var(--az3)]', dot: 'bg-[color:var(--az3)]' }
			case 'maintenance':
				return { label: 'Mantenimiento', className: 'bg-[color:var(--surface-2)] text-[color:var(--text)] border-[color:var(--border)]', dot: 'bg-[color:var(--border)]' }
			case 'available':
			default:
				return { label: 'Disponible', className: 'bg-[color:var(--surface-2)] text-[color:var(--az2)] border-[color:var(--az4)]', dot: 'bg-[color:var(--az4)]' }
		}
	}

	const [grRefreshLoading, setGrRefreshLoading] = useState(false)
	const gravesStorageKey = 'ui.admin.graves.seenMaxId'
	const [grSeenMaxId, setGrSeenMaxId] = useState(() => {
		const v = safeStorageGet(gravesStorageKey)
		const n = v != null ? Number(v) : null
		return Number.isFinite(n) ? n : null
	})
	const grCurrentMaxId = useMemo(() => {
		const ids = graves.map((g) => Number(g.id)).filter((n) => Number.isFinite(n))
		return ids.length ? Math.max(...ids) : 0
	}, [graves])
	useEffect(() => {
		if (grSeenMaxId == null && grCurrentMaxId > 0) {
			setGrSeenMaxId(grCurrentMaxId)
			safeStorageSet(gravesStorageKey, String(grCurrentMaxId))
		}
	}, [grCurrentMaxId, grSeenMaxId])
	useEffect(() => {
		if (grSeenMaxId != null) safeStorageSet(gravesStorageKey, String(grSeenMaxId))
	}, [grSeenMaxId])
	const grNewCount = useMemo(() => {
		if (grSeenMaxId == null) return 0
		return graves.filter((g) => Number(g.id) > Number(grSeenMaxId)).length
	}, [graves, grSeenMaxId])
	async function doRefreshGravesList() {
		setGrRefreshLoading(true)
		try {
			await onRefresh?.()
		} finally {
			setGrRefreshLoading(false)
		}
	}
	const [sectorName, setSectorName] = useState('')
	const [sectorLoading, setSectorLoading] = useState(false)
	const [sectorMsg, setSectorMsg] = useState('')
	const canCreateSector = useMemo(() => sectorName.trim().length >= 1, [sectorName])

	const [graveSectorId, setGraveSectorId] = useState('')
	const [graveRow, setGraveRow] = useState('')
	const [graveCol, setGraveCol] = useState('')
	const [graveTypeId, setGraveTypeId] = useState('')
	const [graveStatus, setGraveStatus] = useState('available')
	const [gravePrice, setGravePrice] = useState('')
	const [graveEnabled, setGraveEnabled] = useState(true)
	const [graveNotes, setGraveNotes] = useState('')
	const [graveLoading, setGraveLoading] = useState(false)
	const [graveMsg, setGraveMsg] = useState('')
	const canCreateGrave = useMemo(() => !graveLoading, [graveLoading])

	async function createSector(e) {
		e?.preventDefault()
		setSectorLoading(true)
		setSectorMsg('')
		try {
			const result = await api('/api/admin/sectors', {
				method: 'POST',
				body: JSON.stringify({ name: sectorName }),
			})
			if (!result.ok) {
				setSectorMsg(result.data?.error || 'No se pudo crear el sector')
				return
			}
			setSectorMsg('Sector creado')
			setSectorName('')
			await onRefresh?.()
		} finally {
			setSectorLoading(false)
		}
	}

	async function ensureDefaultSectors() {
		setSectorLoading(true)
		setSectorMsg('')
		try {
			for (const name of ['A', 'B', 'C', 'D']) {
				await api('/api/admin/sectors', { method: 'POST', body: JSON.stringify({ name }) })
			}
			setSectorMsg('Sectores A–D listos')
			await onRefresh?.()
		} finally {
			setSectorLoading(false)
		}
	}

	async function createGrave(e) {
		e?.preventDefault()
		setGraveLoading(true)
		setGraveMsg('')
		try {
			const priceCents = gravePrice.trim() ? Math.round(Number(gravePrice) * 100) : 0
			if (!Number.isFinite(priceCents) || priceCents < 0) {
				setGraveMsg('Precio inválido')
				return
			}
			const body = {
				sectorId: graveSectorId ? Number(graveSectorId) : null,
				rowNumber: normalizeNumber(graveRow),
				colNumber: normalizeNumber(graveCol),
				graveTypeId: graveTypeId ? Number(graveTypeId) : null,
				status: graveStatus,
				priceCents,
				isEnabled: graveEnabled,
				notes: graveNotes.trim() ? graveNotes.trim() : null,
			}
			const result = await api('/api/admin/graves', {
				method: 'POST',
				body: JSON.stringify(body),
			})
			if (!result.ok) {
				setGraveMsg(result.data?.error || 'No se pudo crear la tumba')
				return
			}
			const code = result.data?.grave?.code
			setGraveMsg(code ? `Tumba creada: ${code}` : 'Tumba creada')
			setGraveRow('')
			setGraveCol('')
			setGravePrice('')
			setGraveEnabled(true)
			setGraveNotes('')
			await onRefresh?.()
		} finally {
			setGraveLoading(false)
		}
	}

	const [graveEditLoadingId, setGraveEditLoadingId] = useState(null)
	async function updateGraveStatus(graveId, status) {
		setGraveEditLoadingId(graveId)
		try {
			await api(`/api/admin/graves/${graveId}`, {
				method: 'PATCH',
				body: JSON.stringify({ status }),
			})
			await onRefresh?.()
		} finally {
			setGraveEditLoadingId(null)
		}
	}

	async function updateGravePublish(graveId, patch) {
		setGraveEditLoadingId(graveId)
		try {
			await api(`/api/admin/graves/${graveId}`, {
				method: 'PATCH',
				body: JSON.stringify(patch),
			})
			await onRefresh?.()
		} finally {
			setGraveEditLoadingId(null)
		}
	}

	// Grilla por sector (para crear filas/columnas y previsualizar)
	const [gridSectorId, setGridSectorId] = useState('')
	const [gridRows, setGridRows] = useState('')
	const [gridCols, setGridCols] = useState('')
	const [gridPrice, setGridPrice] = useState('')
	const [gridGraveTypeId, setGridGraveTypeId] = useState('')
	const [gridLoading, setGridLoading] = useState(false)
	const [gridMsg, setGridMsg] = useState('')

	const [mapLoading, setMapLoading] = useState(false)
	const [mapError, setMapError] = useState('')
	const [mapSectors, setMapSectors] = useState([])
	const [mapSectorId, setMapSectorId] = useState(null)
	const [mapGraves, setMapGraves] = useState([])

	useEffect(() => {
		if (!gridSectorId && sectors.length > 0) {
			setGridSectorId(String(sectors[0].id))
		}
	}, [gridSectorId, sectors])

	useEffect(() => {
		if (!gridSectorId) return
		loadAdminMap(Number(gridSectorId))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [gridSectorId])

	const currentMaxRow = useMemo(() => {
		const rows = mapGraves.map((g) => Number(g.row_number)).filter((n) => Number.isFinite(n))
		return rows.length ? Math.max(...rows) : 0
	}, [mapGraves])

	const currentMaxCol = useMemo(() => {
		const cols = mapGraves.map((g) => Number(g.col_number)).filter((n) => Number.isFinite(n))
		return cols.length ? Math.max(...cols) : 0
	}, [mapGraves])

	const mapCols = useMemo(() => {
		return Math.max(currentMaxCol, 0)
	}, [currentMaxCol])

	function computeCellState(g) {
		if (!g) return 'maintenance'
		if (g.has_burial || g.grave_status === 'occupied') return 'occupied'
		if (g.active_reservation_status === 'confirmed' || g.grave_status === 'reserved') return 'confirmed'
		if (g.active_reservation_status === 'pending') return 'pending'
		if (g.grave_status === 'maintenance' || g.is_enabled === false) return 'maintenance'
		return 'available'
	}

	function displayCellNumber(g) {
		const r = Number(g?.row_number)
		const c = Number(g?.col_number)
		if (!Number.isFinite(r) || !Number.isFinite(c) || !Number.isFinite(mapCols) || mapCols <= 0) return ''
		return String((r - 1) * mapCols + c)
	}

	async function loadAdminMap(sectorId) {
		setMapLoading(true)
		setMapError('')
		try {
			const result = await api(`/api/admin/grave-map?sectorId=${encodeURIComponent(String(sectorId))}`)
			if (!result.ok) {
				setMapError(result.data?.error || 'No se pudo cargar el mapa')
				setMapSectors([])
				setMapSectorId(null)
				setMapGraves([])
				return
			}
			setMapSectors(Array.isArray(result.data?.sectors) ? result.data.sectors : [])
			setMapSectorId(result.data?.sectorId ?? null)
			setMapGraves(Array.isArray(result.data?.graves) ? result.data.graves : [])
		} finally {
			setMapLoading(false)
		}
	}

	async function generateGrid(e) {
		e?.preventDefault()
		setGridLoading(true)
		setGridMsg('')
		try {
			const sectorId = Number(gridSectorId)
			if (!Number.isFinite(sectorId)) {
				setGridMsg('Selecciona un sector')
				return
			}

			const rows = normalizeNumber(gridRows)
			const cols = normalizeNumber(gridCols)
			if (!Number.isFinite(rows) || rows < 1) {
				setGridMsg('Filas inválidas')
				return
			}
			if (!Number.isFinite(cols) || cols < 1) {
				setGridMsg('Columnas inválidas')
				return
			}

			const priceCents = gridPrice.trim() ? Math.round(Number(gridPrice) * 100) : 0
			if (!Number.isFinite(priceCents) || priceCents < 0) {
				setGridMsg('Precio inválido')
				return
			}

			const body = {
				rows,
				cols,
				priceCents,
				graveTypeId: gridGraveTypeId ? Number(gridGraveTypeId) : null,
				isEnabled: true,
			}
			const result = await api(`/api/admin/sectors/${sectorId}/grid`, {
				method: 'POST',
				body: JSON.stringify(body),
			})
			if (!result.ok) {
				setGridMsg(result.data?.error || 'No se pudo generar la grilla')
				return
			}
			setGridMsg(`Listo: +${result.data?.createdGraves ?? 0} parcelas creadas`) 
			await onRefresh?.()
			await loadAdminMap(sectorId)
		} finally {
			setGridLoading(false)
		}
	}

	return (
		<Card title="Gestionar tumbas">
			<form className="space-y-2" onSubmit={createSector}>
				<div className="text-xs text-[color:var(--text)]">Crear sector</div>
				<div className="flex gap-2">
					<input
						value={sectorName}
						onChange={(e) => setSectorName(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
						placeholder="A"
					/>
					<button
						disabled={!canCreateSector || sectorLoading}
						className="rounded-md bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
					>
						{sectorLoading ? 'Creando…' : 'Crear'}
					</button>
				</div>
				<button
					type="button"
					onClick={ensureDefaultSectors}
					disabled={sectorLoading}
					className="w-full rounded-md border border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--text-h)] hover:bg-[color:var(--hover)] disabled:opacity-50"
				>
					Crear sectores A–D
				</button>
				{sectorMsg && <p className="text-xs text-[color:var(--text)]">{sectorMsg}</p>}
			</form>

			<form className="space-y-2" onSubmit={createGrave}>
				<div className="text-xs text-[color:var(--text)]">Crear tumba</div>
				<div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-2 text-sm text-[color:var(--text)]">
					Código: <span className="font-medium text-[color:var(--text-h)]">se genera automáticamente</span> (t-0001, t-0002…)
				</div>
				<div className="grid grid-cols-3 gap-2">
					<select
						value={graveSectorId}
						onChange={(e) => setGraveSectorId(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					>
						<option value="">Sector</option>
						{sectors.map((s) => (
							<option key={s.id} value={String(s.id)}>
								{s.name}
							</option>
						))}
					</select>
					<input
						value={graveRow}
						onChange={(e) => setGraveRow(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
						placeholder="Fila"
						inputMode="numeric"
					/>
					<input
						value={graveCol}
						onChange={(e) => setGraveCol(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
						placeholder="Col"
						inputMode="numeric"
					/>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<input
						value={gravePrice}
						onChange={(e) => setGravePrice(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
						placeholder="Precio (PEN)"
						inputMode="decimal"
					/>
					<label className="flex items-center gap-2 rounded-md border border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--text)]">
						<input type="checkbox" checked={graveEnabled} onChange={(e) => setGraveEnabled(e.target.checked)} />
						Habilitado
					</label>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<select
						value={graveTypeId}
						onChange={(e) => setGraveTypeId(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					>
						<option value="">Tipo</option>
						{graveTypes.map((t) => (
							<option key={t.id} value={String(t.id)}>
								{t.name}
							</option>
						))}
					</select>
					<select
						value={graveStatus}
						onChange={(e) => setGraveStatus(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					>
						<option value="available">available</option>
						<option value="reserved">reserved</option>
						<option value="occupied">occupied</option>
						<option value="maintenance">maintenance</option>
					</select>
				</div>
				<input
					value={graveNotes}
					onChange={(e) => setGraveNotes(e.target.value)}
					className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					placeholder="Notas (opcional)"
				/>
				<button
					disabled={!canCreateGrave || graveLoading}
					className="w-full rounded-md bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
				>
					{graveLoading ? 'Creando…' : 'Crear tumba'}
				</button>
				{graveMsg && <p className="text-xs text-[color:var(--text)]">{graveMsg}</p>}
			</form>

			<form className="space-y-2" onSubmit={generateGrid}>
				<div className="text-xs text-[color:var(--text)]">Grilla por sector (filas/columnas)</div>
				<div className="grid grid-cols-3 gap-2">
					<select
						value={gridSectorId}
						onChange={(e) => setGridSectorId(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					>
						<option value="">Sector</option>
						{sectors.map((s) => (
							<option key={s.id} value={String(s.id)}>
								{s.name}
							</option>
						))}
					</select>
					<input
						value={gridRows}
						onChange={(e) => setGridRows(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
						placeholder={currentMaxRow ? `Filas (actual ${currentMaxRow})` : 'Filas'}
						inputMode="numeric"
					/>
					<input
						value={gridCols}
						onChange={(e) => setGridCols(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
						placeholder={currentMaxCol ? `Cols (actual ${currentMaxCol})` : 'Cols'}
						inputMode="numeric"
					/>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<input
						value={gridPrice}
						onChange={(e) => setGridPrice(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
						placeholder="Precio por parcela (PEN)"
						inputMode="decimal"
					/>
					<select
						value={gridGraveTypeId}
						onChange={(e) => setGridGraveTypeId(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					>
						<option value="">Tipo</option>
						{graveTypes.map((t) => (
							<option key={t.id} value={String(t.id)}>
								{t.name}
							</option>
						))}
					</select>
				</div>
				<button
					disabled={gridLoading || !gridSectorId}
					className="w-full rounded-md bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
				>
					{gridLoading ? 'Generando…' : 'Generar / agregar celdas'}
				</button>
				{gridMsg && <p className="text-xs text-[color:var(--text)]">{gridMsg}</p>}
			</form>

			<div className="text-xs text-[color:var(--text)]">Mapa (cuadro por cuadro)</div>
			<div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] p-3">
				{mapLoading && <div className="text-sm text-[color:var(--text)]">Cargando mapa…</div>}
				{mapError && <div className="text-sm text-red-600">{mapError}</div>}
				{!mapLoading && !mapError && mapGraves.length === 0 && (
					<div className="text-sm text-[color:var(--text)]">Aún no hay parcelas en este sector.</div>
				)}
				{!mapLoading && !mapError && mapGraves.length > 0 && (
					<div>
						<div
							className="ui-grave-grid"
							style={{ gridTemplateColumns: `repeat(${Math.max(mapCols || 6, 1)}, var(--cell-w))` }}
						>
							{mapGraves.map((g) => (
								<div key={g.id} className="ui-grave-cell" data-state={computeCellState(g)} title={g.code}>
									{displayCellNumber(g) || '•'}
								</div>
							))}
						</div>
						<div className="ui-grave-legend">
							<div className="ui-grave-legend__item">
								<span className="ui-grave-legend__swatch" style={{ background: 'color-mix(in oklab, var(--az4) 16%, var(--surface))' }} />
								Disponible
							</div>
							<div className="ui-grave-legend__item">
								<span className="ui-grave-legend__swatch" style={{ background: 'color-mix(in oklab, var(--az4) 22%, var(--surface))' }} />
								Reservada (pendiente)
							</div>
							<div className="ui-grave-legend__item">
								<span className="ui-grave-legend__swatch" style={{ background: 'color-mix(in oklab, var(--az3) 85%, var(--surface))' }} />
								Confirmada
							</div>
							<div className="ui-grave-legend__item">
								<span className="ui-grave-legend__swatch" style={{ background: 'color-mix(in oklab, var(--az1) 92%, var(--surface))' }} />
								Ingresado (ocupada)
							</div>
						</div>
					</div>
				)}
			</div>

			<div className="text-xs text-[color:var(--text)]">Últimas tumbas</div>
			<div className="flex items-center justify-between gap-2">
				<div className="text-xs text-[color:var(--text)]">Últimas tumbas</div>
				<div className="flex items-center gap-2">
					{grNewCount > 0 && (
						<span className="rounded-full bg-[color:var(--surface-2)] px-2 py-1 text-[11px] font-medium text-[color:var(--az2)]">
							Nuevos: {grNewCount}
						</span>
					)}
					<button
						type="button"
						onClick={() => setGrSeenMaxId(grCurrentMaxId || null)}
						disabled={graves.length === 0 || grCurrentMaxId === 0 || grNewCount === 0}
						className="rounded-md border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--text-h)] hover:bg-[color:var(--hover)] disabled:opacity-50"
					>
						Marcar vistos
					</button>
					<button
						type="button"
						onClick={doRefreshGravesList}
						disabled={grRefreshLoading}
						className="rounded-md border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--text-h)] hover:bg-[color:var(--hover)] disabled:opacity-50"
					>
						{grRefreshLoading ? 'Actualizando…' : 'Actualizar'}
					</button>
				</div>
			</div>
			<div className="flex flex-wrap gap-3 text-[11px] text-[color:var(--text)]">
				<div className="flex items-center gap-2">
					<span className={`inline-block h-2 w-2 rounded-full ${graveStatusUi('available').dot}`} />
					Disponible
				</div>
				<div className="flex items-center gap-2">
					<span className={`inline-block h-2 w-2 rounded-full ${graveStatusUi('reserved').dot}`} />
					Reservada
				</div>
				<div className="flex items-center gap-2">
					<span className={`inline-block h-2 w-2 rounded-full ${graveStatusUi('occupied').dot}`} />
					Ocupada
				</div>
				<div className="flex items-center gap-2">
					<span className="inline-block h-2 w-2 rounded-full bg-[color:var(--az4)]" style={{ opacity: 0.35 }} />
					Nuevo
				</div>
			</div>
			<div className="max-h-[420px] overflow-y-auto rounded-md border border-[color:var(--border)] md:max-h-[560px]">
				{graves.length === 0 ? (
					<div className="p-3 text-sm text-[color:var(--text)]">Sin tumbas.</div>
				) : (
					graves.slice(0, 200).map((g) => (
						<div
							key={g.id}
							className="flex items-center justify-between gap-2 border-b border-[color:var(--border)] p-3 last:border-b-0"
						>
							<div>
								<div className="text-sm font-medium text-[color:var(--text-h)]">
									<span className={Number(g.id) > Number(grSeenMaxId || 0) ? 'text-[color:var(--az2)]' : ''}>{g.code}</span>
									{Number(g.id) > Number(grSeenMaxId || 0) && (
										<span className="ml-2 rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--az2)]">
											NUEVO
										</span>
									)}
								</div>
								<div className="text-xs text-[color:var(--text)]">
									{g.sector_name ? g.sector_name : '—'}
									{g.row_number != null ? ` / Fila ${g.row_number}` : ''}
									{g.col_number != null ? ` / Col ${g.col_number}` : ''} · {g.status}
									{g.latitude != null && g.longitude != null ? ` · ${g.latitude}, ${g.longitude}` : ''}
								</div>
								<div className="text-xs text-[color:var(--text)]">
									Precio:{' '}
									<span className="font-medium text-[color:var(--text-h)]">{formatMoney(g.price_cents, 'PEN')}</span> ·{' '}
									<span className={g.is_enabled === false ? 'text-red-600' : 'text-[color:var(--text)]'}>
										{g.is_enabled === false ? 'Deshabilitado' : 'Habilitado'}
									</span>
								</div>
							</div>
							<div className="flex flex-col gap-2">
								<select
									value={g.status}
									onChange={(e) => updateGraveStatus(g.id, e.target.value)}
									disabled={graveEditLoadingId === g.id}
									className={
										'rounded-md border px-2 py-1 text-xs disabled:opacity-50 ' + graveStatusUi(g.status).className
									}
								>
									<option value="available">available</option>
									<option value="reserved">reserved</option>
									<option value="occupied">occupied</option>
									<option value="maintenance">maintenance</option>
								</select>
								<label className="flex items-center justify-end gap-2 text-xs text-[color:var(--text)]">
									<input
										type="checkbox"
										checked={g.is_enabled !== false}
										disabled={graveEditLoadingId === g.id}
										onChange={(e) => updateGravePublish(g.id, { isEnabled: e.target.checked })}
									/>
									Habilitado
								</label>
							</div>
						</div>
					))
				)}
			</div>
		</Card>
	)
}
