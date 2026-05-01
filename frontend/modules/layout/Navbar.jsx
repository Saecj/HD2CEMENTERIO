import { useEffect, useState } from 'react'
import { TabButton } from './TabButton'

function NavSearchForm({
	className,
	inputId,
	showButton = false,
	buttonLabel = 'Buscar',
	inputClassName,
	value,
	onValueChange,
	onSubmit,
}) {
	const resolvedId = inputId || 'navbar-nav-search'
	return (
		<form
			onSubmit={(e) => {
				onSubmit?.(e)
			}}
			className={className}
		>
			<label className="sr-only" htmlFor={resolvedId}>
				Buscar
			</label>
			<div className={showButton ? 'flex items-center gap-2' : undefined}>
				<div className="relative flex-1">
					<svg
						className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text)]"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<circle cx="11" cy="11" r="8" />
						<path d="m21 21-4.3-4.3" />
					</svg>
					<input
						id={resolvedId}
						value={value}
						onChange={(e) => onValueChange?.(e.target.value)}
						onKeyDown={(e) => {
							if (e.key !== 'Enter') return
							// En algunos teclados/IME, Enter confirma composición.
							const native = e.nativeEvent
							if (e.isComposing || native?.isComposing || e.keyCode === 229) {
								e.preventDefault()
								e.stopPropagation()
							}
						}}
						className={
							inputClassName ||
							'w-full rounded-md border-2 border-[color:var(--accent-border)] bg-transparent py-2 pl-9 pr-3 text-sm text-[color:var(--text-h)] placeholder:text-[color:var(--text)] outline-none transition-colors focus:ring-2 focus:ring-[color:var(--accent-border)]/40'
						}
						placeholder="Buscar… (nombre, RSV-…, pagos pendientes/pagados)"
						autoComplete="off"
					/>
				</div>
				{showButton ? (
					<button
						type="submit"
						className="h-10 rounded-md bg-[color:var(--accent)] px-4 text-sm font-semibold text-[color:var(--on-accent)] ring-1 ring-[color:var(--accent-border)] shadow-[var(--shadow)]"
					>
						{buttonLabel}
					</button>
				) : null}
			</div>
		</form>
	)
}

export function Navbar({
	tabs,
	activeTab,
	onTabChange,
	me,
	onSearch,
	notifications,
	onNotificationAction,
	onNotificationDismiss,
	onNotificationClear,
	onLogin,
	onLogout,
}) {
	const [notifOpen, setNotifOpen] = useState(false)
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const [navQuery, setNavQuery] = useState('')
	const count = Array.isArray(notifications) ? notifications.length : 0
	const isStaff = me?.role === 'admin' || me?.role === 'employee'

	useEffect(() => {
		if (!me) setNotifOpen(false)
	}, [me])

	useEffect(() => {
		if (!me) return
		// Mantener el menú en un estado consistente al cambiar de sesión.
		setMobileMenuOpen(false)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [me?.id])

	useEffect(() => {
		if (!notifOpen) return
		function onKeyDown(e) {
			if (e.key === 'Escape') setNotifOpen(false)
		}
		function onMouseDown(e) {
			const el = e.target
			if (!(el instanceof Element)) return
			if (el.closest('[data-notif-root="1"]')) return
			setNotifOpen(false)
		}
		window.addEventListener('keydown', onKeyDown)
		window.addEventListener('mousedown', onMouseDown)
		return () => {
			window.removeEventListener('keydown', onKeyDown)
			window.removeEventListener('mousedown', onMouseDown)
		}
	}, [notifOpen])

	function onNavSubmit(e) {
		e?.preventDefault()
		const q = String(navQuery || '').trim()
		if (!q) return
		onSearch?.(q)
		setMobileMenuOpen(false)
	}

	function NotificationsBell({ disabled }) {
		return (
			<div className="relative" data-notif-root="1">
				<button
					onClick={() => {
						if (disabled) return
						setNotifOpen((v) => !v)
					}}
					disabled={!!disabled}
					className="relative inline-flex h-9 items-center gap-2 rounded-md border border-[color:var(--border)] bg-transparent px-2.5 text-sm font-medium text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
					aria-haspopup="menu"
					aria-expanded={!disabled && notifOpen ? 'true' : 'false'}
					type="button"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
						<path d="M13.73 21a2 2 0 0 1-3.46 0" />
					</svg>
					{count > 0 ? (
						<span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[color:var(--accent)] px-2 py-0.5 text-xs font-semibold text-[color:var(--on-accent)]">
							{count}
						</span>
					) : null}
				</button>

				{!disabled && notifOpen ? (
					<div
						role="menu"
						className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-2 shadow-sm"
					>
						{count === 0 ? (
							<div className="px-2 py-2 text-sm text-[color:var(--text)]">Sin novedades.</div>
						) : (
							<div className="space-y-2">
								{notifications.map((n) => (
									<div
										key={n.id}
										className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] p-3"
									>
										<div className="text-sm font-semibold text-[color:var(--text-h)]">{n.title}</div>
										{n.message ? <div className="mt-1 text-sm text-[color:var(--text)]">{n.message}</div> : null}
										<div className="mt-2 flex flex-wrap items-center gap-2">
											{n.action?.tabId ? (
												<button
													onClick={() => {
													onNotificationAction?.(n.action.tabId, n.id)
													setNotifOpen(false)
												}}
												className="rounded-md bg-[color:var(--accent)] px-3 py-2 text-xs font-medium text-[color:var(--on-accent)]"
												type="button"
											>
												{n.action.label || 'Ver'}
											</button>
											) : null}
											<button
												onClick={() => onNotificationDismiss?.(n.id)}
												className="rounded-md border border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
												type="button"
											>
												Cerrar
											</button>
										</div>
									</div>
								))}
								<div className="flex justify-end">
									<button
										onClick={() => onNotificationClear?.()}
										className="rounded-md border border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
										type="button"
									>
										Limpiar
									</button>
								</div>
							</div>
						)}
					</div>
				) : null}
			</div>
		)
	}

	function resolveDisplayUsername() {
		const raw = String(me?.username || '').trim()
		if (raw) return raw
		const email = String(me?.email || '').trim()
		if (email.includes('@')) return email.split('@')[0]
		return email || 'Usuario'
	}

	function UserGreeting() {
		if (!me) return null
		const username = resolveDisplayUsername()
		const initial = (username[0] || 'U').toUpperCase()
		return (
			<div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-transparent px-2 py-1.5">
				<div className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--surface-2)] text-sm font-semibold text-[color:var(--text-h)]">
					{initial}
					<span
						className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--az3)]"
						aria-label="Activo"
					/>
				</div>
				<div className="max-w-[10rem] overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[color:var(--text)] sm:max-w-[14rem]">
					Hola, <span className="font-medium text-[color:var(--text-h)]">{username}</span>
				</div>
			</div>
		)
	}

	return (
		<nav
			className="theme-dark border-b border-[color:var(--border)]"
			style={{ background: 'var(--nav-gradient-soft, var(--nav-gradient))' }}
		>
			<div className="mx-auto max-w-4xl px-4">
				{/* Fila 1 */}
				<div className="py-3">
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
						<div className="flex items-center justify-between gap-3">
							<div className="text-left">
								<div className="text-base font-semibold text-[color:var(--text-h)]">
									<span aria-hidden="true" className="mr-2">
										🪦
									</span>
									QRKATA
								</div>
								<div className="text-xs text-[color:var(--text)]">Cementerio digital</div>
							</div>

								<div className="flex items-center justify-end gap-2 md:hidden">
								<NotificationsBell disabled={!me} />
								<UserGreeting />
								{isStaff && typeof onLogout === 'function' ? (
									<button
										onClick={onLogout}
										type="button"
										className="inline-flex h-9 items-center rounded-md border border-[color:var(--border)] bg-transparent px-3 text-sm font-medium text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
									>
										Cerrar sesión
									</button>
								) : null}
								{!me ? (
									<button
										onClick={onLogin}
										className="rounded-md bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-[color:var(--on-accent)] ring-1 ring-[color:var(--accent-border)] shadow-[var(--shadow)]"
									>
										Iniciar sesión
									</button>
								) : null}
							</div>
						</div>

							{/* Móvil: fila de acciones (menú + buscador + botón Buscar) */}
							<div className="flex items-center gap-2 md:hidden">
								<button
									type="button"
									onClick={() => {
										setMobileMenuOpen((v) => !v)
										setNotifOpen(false)
									}}
									className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--border)] bg-transparent text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
									aria-label="Menú"
									aria-expanded={mobileMenuOpen ? 'true' : 'false'}
									aria-controls="navbar-mobile-menu"
								>
									<svg
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										aria-hidden="true"
									>
										<path d="M4 6h16" />
										<path d="M4 12h16" />
										<path d="M4 18h16" />
									</svg>
								</button>
								<NavSearchForm
									className="w-full flex-1"
									inputId="navbar-nav-search-mobile-inline"
									showButton
									buttonLabel="Buscar"
									inputClassName="w-full h-10 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-2)] py-2 pl-9 pr-3 text-sm text-[color:var(--text-h)] placeholder:text-[color:var(--text)] outline-none transition-colors focus:border-[color:var(--accent-border)]"
									value={navQuery}
									onValueChange={setNavQuery}
									onSubmit={onNavSubmit}
								/>
							</div>

							{/* Móvil: menú de enlaces/tabs (se desplaza, no es overlay) */}
							{mobileMenuOpen ? (
								<div id="navbar-mobile-menu" className="md:hidden">
									<div className="mt-2 flex flex-wrap gap-1">
										{tabs.map((t) => {
											if (t.id !== 'profile') {
												return (
													<TabButton
														key={t.id}
														active={activeTab === t.id}
														onClick={() => {
															onTabChange(t.id)
															setMobileMenuOpen(false)
														}}
													>
														{t.label}
													</TabButton>
												)
											}

											return (
												<div key={t.id} className="flex items-center gap-1">
													<TabButton
														active={activeTab === t.id}
														onClick={() => {
															onTabChange(t.id)
															setMobileMenuOpen(false)
														}}
													>
														<span className="inline-flex items-center gap-2">
															<svg
																width="16"
																height="16"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																strokeWidth="2"
																strokeLinecap="round"
																strokeLinejoin="round"
																aria-hidden="true"
															>
																<path d="M20 21a8 8 0 0 0-16 0" />
																<circle cx="12" cy="7" r="4" />
															</svg>
															<span>{t.label}</span>
														</span>
													</TabButton>

												{me && typeof onLogout === 'function' ? (
														<button
															onClick={() => {
																onLogout()
																setMobileMenuOpen(false)
														}}
															type="button"
															className="inline-flex h-9 items-center rounded-md border border-[color:var(--border)] bg-transparent px-3 text-sm font-medium text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
														>
															Cerrar sesión
														</button>
													) : null}
												</div>
											)
										})}
									</div>
								</div>
							) : null}

						{/* Desktop: bloque a la derecha (buscador + campana + correo) */}
						<div className="hidden items-center gap-2 md:flex md:flex-1 md:justify-end">
							<NavSearchForm
								className="w-full flex-1 max-w-[34rem]"
								inputId="navbar-nav-search-desktop"
								value={navQuery}
								onValueChange={setNavQuery}
								onSubmit={onNavSubmit}
							/>
							<NotificationsBell disabled={!me} />
							{me ? (
								<>
									<UserGreeting />
									{isStaff && typeof onLogout === 'function' ? (
										<button
											onClick={onLogout}
											type="button"
											className="inline-flex h-9 items-center rounded-md border border-[color:var(--border)] bg-transparent px-3 text-sm font-medium text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
										>
											Cerrar sesión
										</button>
									) : null}
								</>
							) : (
								<button
									onClick={onLogin}
									className="rounded-md bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-[color:var(--on-accent)] ring-1 ring-[color:var(--accent-border)] shadow-[var(--shadow)]"
								>
									Iniciar sesión
								</button>
							)}
						</div>
					</div>
				</div>

				{/* Fila 2 */}
				<div className="hidden pb-3 md:block">
					<div className="flex flex-wrap items-center justify-center gap-1">
						{tabs.map((t) => {
							if (t.id !== 'profile') {
								return (
									<TabButton key={t.id} active={activeTab === t.id} onClick={() => onTabChange(t.id)}>
										{t.label}
									</TabButton>
								)
							}

							return (
								<div key={t.id} className="flex items-center gap-1">
									<TabButton active={activeTab === t.id} onClick={() => onTabChange(t.id)}>
										<span className="inline-flex items-center gap-2">
											<svg
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
												aria-hidden="true"
											>
												<path d="M20 21a8 8 0 0 0-16 0" />
												<circle cx="12" cy="7" r="4" />
											</svg>
											<span>{t.label}</span>
										</span>
									</TabButton>

									{me && typeof onLogout === 'function' ? (
										<button
											onClick={onLogout}
											type="button"
											className="inline-flex h-9 items-center rounded-md border border-[color:var(--border)] bg-transparent px-3 text-sm font-medium text-[color:var(--text-h)] hover:bg-[color:var(--hover)]"
										>
											Cerrar sesión
										</button>
									) : null}
								</div>
							)
						})}
					</div>
				</div>
			</div>
		</nav>
	)
}
