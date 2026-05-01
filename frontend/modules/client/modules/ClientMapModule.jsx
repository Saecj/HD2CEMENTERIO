import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../../layout/Panel'
import { api } from '../../../lib/api'
import { MapView } from '../MapView'

function makeStableSeed(input) {
	const s = String(input ?? '')
	let h = 2166136261
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return h >>> 0
}

function stable01(seed) {
	// LCG simple en 32-bit para obtener un número en [0,1)
	let x = seed >>> 0
	x = (Math.imul(1664525, x) + 1013904223) >>> 0
	return x / 2 ** 32
}

function recordKey(r) {
	// SearchView usa `it.id` como id de reserva
	const id = r?.id
	if (id != null) return `resv-${id}`
	if (r?.reservation_code) return `rsv-${r.reservation_code}`
	if (r?.grave_code) return `grave-${r.grave_code}`
	if (r?.deceased_full_name) return `name-${r.deceased_full_name}`
	return 'unknown'
}
function recordKeyyy(r) {
	// SearchView usa `it.id` como id de reserva
	const id = r?.id
	if (id != null) return `resv-${id}`
	if (r?.reservation_code) return `rsv-${r.reservation_code}`
	if (r?.grave_code) return `grave-${r.grave_code}`
	if (r?.deceased_full_name) return `name-${r.deceased_full_name}`
	return 'unknown'
}


export function ClientMapModule({ me, selected, onSelect }) {
	const [loading, setLoading] = useState(false)
	const [items, setItems] = useState([])
	const [error, setError] = useState('')

	useEffect(() => {
		let cancelled = false
		async function load() {
			if (!me) {
				setItems([])
				setError('')
				return
			}
			setLoading(true)
			setError('')
			const res = await api('/api/client/reservations')
			if (cancelled) return
			if (!res.ok) {
				setItems([])
				setError('No se pudo cargar tus difuntos.')
				setLoading(false)
				return
			}
			const raw = Array.isArray(res.data?.reservations) ? res.data.reservations : []
			setItems(raw)
			setLoading(false)
		}
		load()
		return () => {
			cancelled = true
		}
	}, [me])

	const grouped = useMemo(() => {
		// 1 por difunto cuando haya nombre; si no, 1 por reserva.
		const by = new Map()
		for (const r of items) {
			const name = String(r?.deceased_full_name || '').trim()
			const key = name ? `name:${name.toLowerCase()}` : recordKey(r)
			if (!by.has(key)) by.set(key, r)
		}
		return Array.from(by.values())
	}, [items])

	const markers = useMemo(() => {
		return grouped.map((r) => {
			const id = recordKey(r)
			const seed = makeStableSeed(id)
			const x = 10 + stable01(seed) * 80
			const y = 18 + stable01(seed ^ 0x9e3779b9) * 70
			const hue = Math.floor(stable01(seed ^ 0x7f4a7c15) * 300)
			return { id, record: r, x, y, hue }
		})
	}, [grouped])

	return (
		<Panel className="p-0">
			<div className="flex flex-col gap-0 lg:flex-row">
				{/* Lista lateral */}
				<div className="border-b border-[color:var(--border)] bg-[color:var(--surface)] p-3 lg:w-72 lg:border-b-0 lg:border-r">
					<div className="text-sm font-semibold text-[color:var(--text-h)]">Difuntos</div>
					<div className="mt-1 text-xs text-[color:var(--text)]">Marcados en el mapa con un color.</div>

					{!me ? (
						<div className="mt-3 text-sm text-[color:var(--text)]">Inicia sesión para ver tus difuntos.</div>
					) : null}
					{me && loading ? <div className="mt-3 text-sm text-[color:var(--text)]">Cargando…</div> : null}
					{me && error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}

					{me && !loading && !error ? (
						<div className="mt-3 space-y-2">
							{grouped.length === 0 ? (
								<div className="text-sm text-[color:var(--text)]">Aún no tienes difuntos registrados en tu cuenta.</div>
							) : (
								grouped.map((r) => {
									const id = recordKey(r)
									const marker = markers.find((m) => m.id === id)
									const hue = marker?.hue ?? 0
									const name = r?.deceased_full_name || r?.deceased_name || r?.deceasedFullName || '—'
									const active = selected && recordKey(selected) === id
									return (
										<button
											key={id || name}
											type="button"
											onClick={() => onSelect?.(r)}
											className={
												'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-[color:var(--hover)] ' +
												(active
													? 'border-[color:var(--accent-border)] bg-[color:var(--accent-bg)]'
													: 'border-[color:var(--border)] bg-[color:var(--surface-2)]')
											}
										>
											<span
												className="h-3 w-3 rounded-full bg-[color:var(--accent)]"
												style={{ filter: `hue-rotate(${hue}deg) saturate(1.2)` }}
												aria-hidden="true"
											/>
											<span className="flex-1 text-[color:var(--text-h)]">{name}</span>
										</button>
									)
								})
							)}
						</div>
					) : null}
				</div>

				{/* Mapa */}
				<div className="min-w-0 flex-1 p-3">
					<MapView selected={selected} markers={markers} onSelect={onSelect} />
				</div>
			</div>
		</Panel>
	)
}
