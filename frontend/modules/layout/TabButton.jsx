export function TabButton({ active, children, onClick }) {
	return (
		<button
			onClick={onClick}
			className={
				active
					? 'rounded-md bg-[color:var(--accent-bg)] px-3 py-2 text-sm font-medium text-[color:var(--text-h)] ring-1 ring-[color:var(--accent-border)] shadow-[var(--shadow)]'
					: 'rounded-md px-3 py-2 text-sm text-[color:var(--text)] hover:bg-[color:var(--accent-bg)] hover:ring-1 hover:ring-[color:var(--accent-border)] transition-colors'
			}
		>
			{children}
		</button>
	)
}
