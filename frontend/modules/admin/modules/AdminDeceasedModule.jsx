import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { Card, toDateInputValue } from '../ui'

export function AdminDeceasedModule({ deceased, reservations, graves, onRefresh }) {
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

	const gravesForBurial = useMemo(() => graves.filter((g) => g?.status !== 'occupied'), [graves])
	const gravesById = useMemo(() => new Map(graves.map((g) => [Number(g.id), g])), [graves])

	const pendingBurialsFromReservations = useMemo(() => {
		return reservations
			.filter((r) => r?.status === 'confirmed' && r?.grave_id)
			.filter((r) => {
				const g = gravesById.get(Number(r.grave_id))
				return !g || g.status !== 'occupied'
			})
			.slice(0, 50)
	}, [reservations, gravesById])

	const burialRows = useMemo(() => deceased.filter((d) => d?.burial_id).slice(0, 200), [deceased])

	const pendingStorageKey = 'ui.admin.burials.pending.seenMaxResvId'
	const [pendingSeenMaxId, setPendingSeenMaxId] = useState(() => {
		const v = safeStorageGet(pendingStorageKey)
		const n = v != null ? Number(v) : null
		return Number.isFinite(n) ? n : null
	})
	const pendingCurrentMaxId = useMemo(() => {
		const ids = pendingBurialsFromReservations.map((r) => Number(r.id)).filter((n) => Number.isFinite(n))
		return ids.length ? Math.max(...ids) : 0
	}, [pendingBurialsFromReservations])
	useEffect(() => {
		if (pendingSeenMaxId == null && pendingCurrentMaxId > 0) {
			setPendingSeenMaxId(pendingCurrentMaxId)
			safeStorageSet(pendingStorageKey, String(pendingCurrentMaxId))
		}
	}, [pendingCurrentMaxId, pendingSeenMaxId])
	useEffect(() => {
		if (pendingSeenMaxId != null) safeStorageSet(pendingStorageKey, String(pendingSeenMaxId))
	}, [pendingSeenMaxId])
	const pendingNewCount = useMemo(() => {
		if (pendingSeenMaxId == null) return 0
		return pendingBurialsFromReservations.filter((r) => Number(r.id) > Number(pendingSeenMaxId)).length
	}, [pendingBurialsFromReservations, pendingSeenMaxId])

	const burialStorageKey = 'ui.admin.burials.registered.seenMaxBurialId'
	const [burialSeenMaxId, setBurialSeenMaxId] = useState(() => {
		const v = safeStorageGet(burialStorageKey)
		const n = v != null ? Number(v) : null
		return Number.isFinite(n) ? n : null
	})
	const burialCurrentMaxId = useMemo(() => {
		const ids = burialRows.map((d) => Number(d.burial_id)).filter((n) => Number.isFinite(n))
		return ids.length ? Math.max(...ids) : 0
	}, [burialRows])
	useEffect(() => {
		if (burialSeenMaxId == null && burialCurrentMaxId > 0) {
			setBurialSeenMaxId(burialCurrentMaxId)
			safeStorageSet(burialStorageKey, String(burialCurrentMaxId))
		}
	}, [burialCurrentMaxId, burialSeenMaxId])
	useEffect(() => {
		if (burialSeenMaxId != null) safeStorageSet(burialStorageKey, String(burialSeenMaxId))
	}, [burialSeenMaxId])
	const burialNewCount = useMemo(() => {
		if (burialSeenMaxId == null) return 0
		return burialRows.filter((d) => Number(d.burial_id) > Number(burialSeenMaxId)).length
	}, [burialRows, burialSeenMaxId])

	async function doRefresh() {
		setRefreshing(true)
		try {
			await onRefresh?.()
		} finally {
			setRefreshing(false)
		}
	}

	const [dFirstName, setDFirstName] = useState('')
	const [dLastName, setDLastName] = useState('')
	const [dDateDeath, setDDateDeath] = useState('')
	const [dGraveId, setDGraveId] = useState('')
	const [dBurialDate, setDBurialDate] = useState('')
	const [dLoading, setDLoading] = useState(false)
	const [dMsg, setDMsg] = useState('')
	const canCreateBurial = useMemo(
		() => dFirstName.trim().length >= 2 && dLastName.trim().length >= 2 && dGraveId,
		[dFirstName, dLastName, dGraveId],
	)

	function pickReservationForBurial(resv) {
		if (!resv) return
		const full = String(resv.deceased_full_name || '').trim().replace(/\s+/g, ' ')
		if (full) {
			const parts = full.split(' ').filter(Boolean)
			if (parts.length >= 2) {
				setDFirstName(parts.slice(0, -1).join(' '))
				setDLastName(parts.slice(-1).join(' '))
			} else {
				setDFirstName(full)
				setDLastName('')
			}
		}
		if (resv.grave_id) setDGraveId(String(resv.grave_id))

		const baseDate = toDateInputValue(resv.reserved_from) || toDateInputValue(resv.created_at) || toDateInputValue(new Date())
		if (baseDate) {
			setDDateDeath(baseDate)
			setDBurialDate(baseDate)
		}
	}

	async function createBurial(e) {
		e?.preventDefault()
		setDLoading(true)
		setDMsg('')
		try {
			const result = await api('/api/employee/burials', {
				method: 'POST',
				body: JSON.stringify({
					firstName: dFirstName,
					lastName: dLastName,
					dateOfDeath: dDateDeath || null,
					graveId: Number(dGraveId),
					burialDate: dBurialDate || null,
				}),
			})
			if (!result.ok) {
				setDMsg(result.data?.error || 'No se pudo registrar el entierro')
				return
			}
			setDMsg('Entierro registrado')
			setDFirstName('')
			setDLastName('')
			setDDateDeath('')
			setDGraveId('')
			setDBurialDate('')
			await onRefresh?.()
		} finally {
			setDLoading(false)
		}
	}

	return (
		<Card title="Gestionar difuntos">
			<div className="space-y-2">
				<div className="flex items-center justify-between gap-2">
					<div className="text-xs text-[color:var(--text)]">Pendientes de entierro (reservas confirmadas)</div>
					<div className="flex items-center gap-2">
						{pendingNewCount > 0 && (
							<span className="rounded-full bg-[color:var(--surface-2)] px-2 py-1 text-[11px] font-medium text-[color:var(--az2)]">
								Nuevos: {pendingNewCount}
							</span>
						)}
						<button
							type="button"
							onClick={() => setPendingSeenMaxId(pendingCurrentMaxId || null)}
							disabled={pendingBurialsFromReservations.length === 0 || pendingCurrentMaxId === 0 || pendingNewCount === 0}
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
				</div>
				<div className="max-h-[420px] overflow-y-auto rounded-md border border-[color:var(--border)] md:max-h-[560px]">
					{pendingBurialsFromReservations.length === 0 ? (
						<div className="p-3 text-sm text-[color:var(--text)]">No hay pendientes.</div>
					) : (
						pendingBurialsFromReservations.map((r) => (
							<button
								key={r.id}
								onClick={() => pickReservationForBurial(r)}
								className="w-full border-b border-[color:var(--border)] p-3 text-left last:border-b-0 hover:bg-[color:var(--hover)]"
								type="button"
							>
								<div className="text-sm font-medium text-[color:var(--text-h)]">
									<span className={Number(r.id) > Number(pendingSeenMaxId || 0) ? 'text-[color:var(--az2)]' : ''}>
										{r.deceased_full_name || 'Sin nombre'}
									</span>
									{Number(r.id) > Number(pendingSeenMaxId || 0) && (
										<span className="ml-2 rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--az2)]">
											NUEVO
										</span>
									)}
								</div>
								<div className="text-xs text-[color:var(--text)]">Tumba: {r.grave_code || '—'} · {r.client_email || '—'}</div>
							</button>
						))
					)}
				</div>
			</div>

			<form className="space-y-2" onSubmit={createBurial}>
				<div className="text-xs text-[color:var(--text)]">Registrar entierro</div>
				<div className="grid grid-cols-2 gap-2">
					<input
						value={dFirstName}
						onChange={(e) => setDFirstName(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
						placeholder="Nombres"
					/>
					<input
						value={dLastName}
						onChange={(e) => setDLastName(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
						placeholder="Apellidos"
					/>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<input
						type="date"
						value={dDateDeath}
						onChange={(e) => setDDateDeath(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					/>
					<input
						type="date"
						value={dBurialDate}
						onChange={(e) => setDBurialDate(e.target.value)}
						className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
					/>
				</div>
				<select
					value={dGraveId}
					onChange={(e) => setDGraveId(e.target.value)}
					className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
				>
					<option value="">Selecciona tumba</option>
					{gravesForBurial.map((g) => (
						<option key={g.id} value={String(g.id)}>
							{g.code} ({g.status})
						</option>
					))}
				</select>
				<button
					disabled={!canCreateBurial || dLoading}
					className="w-full rounded-md bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
				>
					{dLoading ? 'Registrando…' : 'Registrar entierro'}
				</button>
				{dMsg && <p className="text-xs text-[color:var(--text)]">{dMsg}</p>}
			</form>

			<div className="text-xs text-[color:var(--text)]">Entierros registrados</div>
			<div className="flex items-center justify-between gap-2">
				<div className="text-xs text-[color:var(--text)]">Historial (entierros)</div>
				<div className="flex items-center gap-2">
					{burialNewCount > 0 && (
						<span className="rounded-full bg-[color:var(--surface-2)] px-2 py-1 text-[11px] font-medium text-[color:var(--az2)]">
							Nuevos: {burialNewCount}
						</span>
					)}
					<button
						type="button"
						onClick={() => setBurialSeenMaxId(burialCurrentMaxId || null)}
						disabled={burialRows.length === 0 || burialCurrentMaxId === 0 || burialNewCount === 0}
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
			</div>
			<div className="max-h-[420px] overflow-y-auto rounded-md border border-[color:var(--border)] md:max-h-[560px]">
				{burialRows.length === 0 ? (
					<div className="p-3 text-sm text-[color:var(--text)]">Sin entierros registrados.</div>
				) : (
					burialRows.map((d) => (
							<div key={d.id} className="border-b border-[color:var(--border)] p-3 last:border-b-0">
								<div className="text-sm font-medium text-[color:var(--text-h)]">
									<span className={Number(d.burial_id) > Number(burialSeenMaxId || 0) ? 'text-[color:var(--az2)]' : ''}>
										{d.last_name} {d.first_name}
									</span>
									{Number(d.burial_id) > Number(burialSeenMaxId || 0) && (
										<span className="ml-2 rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--az2)]">
											NUEVO
										</span>
									)}
								</div>
								<div className="text-xs text-[color:var(--text)]">
									Tumba: {d.grave_code || '—'}
									{d.date_of_death ? ` · F. fallecimiento: ${new Date(d.date_of_death).toLocaleDateString()}` : ''}
								</div>
							</div>
						))
				)}
			</div>
		</Card>
	)
}
