export function Card({ title, children }) {
	return (
		<section className="rounded-md border border-[color:var(--border)] p-4">
			<h3 className="text-sm font-semibold text-[color:var(--text-h)]">{title}</h3>
			<div className="mt-3 space-y-3">{children}</div>
		</section>
	)
}

export function StatCard({ label, value, hint }) {
	return (
		<div className="rounded-md border border-[color:var(--border)] p-4">
			<div className="text-xs text-[color:var(--text)]">{label}</div>
			<div className="mt-1 text-2xl font-semibold text-[color:var(--text-h)]">{value}</div>
			{hint ? <div className="mt-1 text-xs text-[color:var(--text)]">{hint}</div> : null}
		</div>
	)
}

export function SidebarButton({ active, children, onClick }) {
	return (
		<button
			onClick={onClick}
			className={
				`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ` +
				(active
					? 'bg-[color:var(--hover)] text-[color:var(--text-h)]'
					: 'text-[color:var(--text)] hover:bg-[color:var(--hover)]')
			}
		>
			{children}
		</button>
	)
}

export function normalizeNumber(value) {
	if (value === '' || value == null) return null
	const n = Number(value)
	return Number.isFinite(n) ? n : null
}

export function formatMoney(cents, currency = 'PEN') {
	const amount = Number(cents || 0) / 100
	try {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
	} catch {
		return `${amount.toFixed(2)} ${currency}`
	}
}

export function toDateInputValue(value) {
	if (!value) return ''
	const d = value instanceof Date ? value : new Date(value)
	if (Number.isNaN(d.getTime())) return ''
	const yyyy = String(d.getFullYear())
	const mm = String(d.getMonth() + 1).padStart(2, '0')
	const dd = String(d.getDate()).padStart(2, '0')
	return `${yyyy}-${mm}-${dd}`
}
