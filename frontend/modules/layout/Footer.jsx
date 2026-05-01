export function Footer() {
	return (
		<footer
			className="theme-dark mt-auto border-t border-[color:var(--border)]"
			style={{ background: 'var(--nav-gradient)' }}
		>
			<div className="mx-auto max-w-6xl px-4 py-6">
				<div className="grid gap-6 md:grid-cols-3">
					<div className="space-y-2">
						<div className="text-sm font-semibold text-[color:var(--text-h)]">QRKATA</div>
						<div className="text-xs text-[color:var(--text)]">Cementerio digital — Prototipo</div>
						<div className="text-xs text-[color:var(--text)]">
							Autores:{' '}
							<span className="font-medium text-[color:var(--text-h)]">Equipo del proyecto</span>
						</div>
					</div>

					<div className="space-y-2">
						<div className="text-xs font-semibold text-[color:var(--text-h)]">Referencias</div>
						<div className="flex flex-wrap gap-2">
							<a
								href="#"
								className="rounded-md border border-[color:var(--border)] bg-transparent px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
							>
								Reglamento interno
							</a>
							<a
								href="#"
								className="rounded-md border border-[color:var(--border)] bg-transparent px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
							>
								Política de privacidad
							</a>
							<a
								href="#"
								className="rounded-md border border-[color:var(--border)] bg-transparent px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
							>
								Manual de usuario
							</a>
						</div>
					</div>

					<div className="space-y-2">
						<div className="text-xs font-semibold text-[color:var(--text-h)]">Redes</div>
						<div className="flex flex-wrap gap-2">
							<a
								href="#"
								className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-transparent px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-h)] hover:bg-[color:var(--accent-bg)]"
								aria-label="Instagram"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
									<path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z" stroke="currentColor" strokeWidth="1.6" />
									<path d="M12 16.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z" stroke="currentColor" strokeWidth="1.6" />
									<path d="M17.6 6.4h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
								</svg>
								Instagram
							</a>
							<a
								href="#"
								className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-transparent px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-h)] hover:bg-[color:var(--accent-bg)]"
								aria-label="Facebook"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
									<path d="M14 8.5V7.2c0-1 .7-1.7 1.7-1.7H17V2h-2.2A4.8 4.8 0 0 0 10 6.8v1.7H7v3.4h3V22h4v-10h3l1-3.4h-4Z" fill="currentColor" />
								</svg>
								Facebook
							</a>
							<a
								href="#"
								className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-transparent px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-h)] hover:bg-[color:var(--accent-bg)]"
								aria-label="WhatsApp"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
									<path d="M12 22a10 10 0 0 0 8.8-14.8A10 10 0 0 0 2.4 17L2 22l5.2-.4A10 10 0 0 0 12 22Z" stroke="currentColor" strokeWidth="1.6" />
									<path d="M9 7.8c.2-.4.4-.4.7-.4h.6c.2 0 .5 0 .6.4l.9 2.2c.1.3.1.5 0 .7l-.4.6c-.1.2-.2.4 0 .7.2.4.8 1.4 1.7 2.2.9.8 1.8 1.2 2.2 1.4.3.1.5.1.7 0l.8-.9c.2-.2.4-.2.6-.1l2.4 1.1c.3.1.4.3.4.6 0 .6-.2 1.9-1.2 2.3-.7.3-1.7.4-4.1-.6-2.6-1.1-4.7-3.7-5.4-5.2-.7-1.5-1-2.8-.6-3.7.2-.5.8-1.2 1.1-1.7Z" fill="currentColor" />
								</svg>
								WhatsApp
							</a>
						</div>
					</div>
				</div>
			</div>
		</footer>
	)
}
