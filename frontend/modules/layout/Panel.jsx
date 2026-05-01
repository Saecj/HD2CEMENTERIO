export function Panel({ children, className = '' }) {
	return (
		<div
			className={
				'rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-left shadow-[var(--shadow)] ' +
				className
			}
		>
			{children}
		</div>
	)
}
