import { useMemo, useState } from 'react'
import cemeteryMapImg from '../../assets/mapa_cementerio.webp'

function recordKey(r) {
	const id = r?.id
	if (id != null) return `resv-${id}`
	if (r?.reservation_code) return `rsv-${r.reservation_code}`
	if (r?.grave_code) return `grave-${r.grave_code}`
	if (r?.deceased_full_name) return `name-${r.deceased_full_name}`
	return ''
}

export function MapView({ selected, markers = [], onSelect }) {
	const [zoom, setZoom] = useState(1)

	const displayName = useMemo(() => {
		if (!selected) return ''
		return selected.deceased_full_name || `${selected.last_name || ''} ${selected.first_name || ''}`.trim() || ''
	}, [selected])

	const hasCoords = selected?.latitude != null && selected?.longitude != null
	const mapHref = hasCoords
		? `https://www.google.com/maps?q=${encodeURIComponent(`${selected.latitude},${selected.longitude}`)}`
		: null

	function clamp(next) {
		return Math.max(1, Math.min(3, Number(next) || 1))
	}

	return (
		<div className="mt-3 space-y-2">
			{/* Encabezado fuera del mapa */}
			<div>Cabecera del sistema</div>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="ui-card rounded-md p-3 text-left">
					<div className="ui-kicker">Mapa</div>
					<div className="mt-0.5 text-sm font-semibold text-[color:var(--text-h)]">Mapa del cementerio</div>
					{selected ? (
						<div className="mt-1 text-xs text-[color:var(--text)]">
							<span className="font-medium text-[color:var(--text-h)]">{displayName || '—'}</span>
							{selected.grave_code ? ` · Tumba ${selected.grave_code}` : ''}
							{selected.sector_name ? ` · ${selected.sector_name}` : ''}
							{selected.row_number != null ? ` / Fila ${selected.row_number}` : ''}
							{selected.col_number != null ? ` / Col ${selected.col_number}` : ''}
							{hasCoords ? (
								<a
									href={mapHref}
									target="_blank"
									rel="noreferrer"
									className="ml-2 inline-flex h-7 items-center rounded-md bg-[color:var(--accent)] px-2 text-xs font-medium text-[color:var(--on-accent)]"
								>
									Google Maps
								</a>
							) : null}
						</div>
					) : (
						<div className="mt-1 text-xs text-[color:var(--text)]">
							Selecciona un difunto en <span className="font-medium text-[color:var(--text-h)]">Búsqueda</span> para ver su ubicación.
						</div>
					)}
				</div>

				<div className="flex items-center justify-end gap-2">
					<button
						type="button"
						onClick={() => setZoom((z) => clamp(z - 0.2))}
						className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
						aria-label="Disminuir zoom"
					>
						−
					</button>
					<button
						type="button"
						onClick={() => setZoom((z) => clamp(z + 0.2))}
						className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[color:var(--accent)] text-[color:var(--on-accent)] ring-1 ring-[color:var(--accent-border)] shadow-[var(--shadow)]"
						aria-label="Aumentar zoom"
					>
						+
					</button>
					<button
						type="button"
						onClick={() => setZoom(1)}
						className="h-10 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-medium text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
					>
						Reset
					</button>
				</div>
			</div>

			{/* Mapa */}
			<div className="relative -mx-4 h-[72vh] w-[calc(100%+2rem)] overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] md:mx-0 md:h-[78vh] md:w-full lg:h-[80vh]">
				{/* Imagen grande sin scroll (al hacer zoom se recorta dentro del marco) */}
				<div className="flex h-full w-full items-center justify-center overflow-hidden">
					<div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }} className="h-full w-full">
						<img
							src={cemeteryMapImg}
							alt="Mapa del cementerio"
							className="block h-full w-full select-none object-contain"
							draggable={false}
						/>
					</div>
				</div>

				{/* Marcadores (posiciones aleatorias estables por difunto) */}
				<div className="absolute inset-0 z-[1]">
					{Array.isArray(markers)
						? markers.map((m) => {
							const name =
								m?.record?.deceased_full_name ||
								m?.record?.deceased_name ||
								m?.record?.deceasedFullName ||
								'Difunto'
							const id = String(m?.id ?? '')
							const active = selected && recordKey(selected) === id
							const hue = Number.isFinite(m?.hue) ? m.hue : 0
							const x = Number.isFinite(m?.x) ? m.x : 50
							const y = Number.isFinite(m?.y) ? m.y : 50
							return (
								<button
									key={id || name}
									type="button"
									onClick={() => onSelect?.(m.record)}
									className="absolute"
									style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -100%)' }}
									aria-label={`Ubicación de ${name}`}
								>
									{/* Etiqueta tipo videojuego */}
									<div className="pointer-events-none relative mb-2">
										<div
											className={
												'rounded-md border bg-[color:var(--surface)]/90 px-3 py-2 text-xs font-semibold text-[color:var(--text-h)] backdrop-blur ' +
												(active ? 'border-[color:var(--accent-border)]' : 'border-[color:var(--border)]')
											}
											style={{ filter: `hue-rotate(${hue}deg) saturate(1.1)` }}
										>
											<span
												className="mr-1 inline-block text-[color:var(--accent)]"
												style={{ filter: 'hue-rotate(120deg) saturate(1.4)' }}
											>
												➤
											</span>
											{name}
										</div>
										<div
											className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[10px] border-x-transparent"
											style={{
												borderTopColor: 'var(--surface)',
												filter: `hue-rotate(${hue}deg) saturate(1.1)`,
											}}
											aria-hidden="true"
										/>
									</div>

									{/* Punto */}
									<span
										className={
											'inline-flex h-3.5 w-3.5 rounded-full border ' +
											(active
												? 'border-[color:var(--accent-border)] bg-[color:var(--accent)]'
												: 'border-[color:var(--border)] bg-[color:var(--accent)]')
										}
										style={{ filter: `hue-rotate(${hue}deg) saturate(1.2)` }}
										aria-hidden="true"
									/>
								</button>
							)
						})
						: null}
				</div>
			</div>
		</div>
	)
}
