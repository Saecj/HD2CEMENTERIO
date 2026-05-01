import { useEffect, useState } from 'react'
import { AuthView } from './AuthView'
import { RegisterView } from './RegisterView'
import { Panel } from '../layout/Panel'

export function AuthPanel({ open, onClose, onLoggedIn }) {
	if (!open) return null

	const [mode, setMode] = useState('login')
	useEffect(() => {
		if (open) setMode('login')
	}, [open])

	useEffect(() => {
		function onKeyDown(e) {
			if (e.key === 'Escape') onClose?.()
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [onClose])

	return (
		<div
			className="fixed inset-0 z-50 overflow-y-auto bg-[color:var(--overlay)] backdrop-blur-sm"
			onMouseDown={onClose}
			role="dialog"
			aria-modal="true"
		>
			<div className="mx-auto flex min-h-full w-full max-w-xl items-center justify-center px-4 py-10">
				<div className="w-full max-w-lg" onMouseDown={(e) => e.stopPropagation()}>
					<Panel className="p-6 rounded-2xl bg-[color:var(--surface-2)] border border-[color:var(--border)] shadow-[var(--shadow)]">
						<div className="flex items-start justify-between gap-3">
							<div className="text-2xl font-semibold leading-tight text-[color:var(--text-h)]">
								{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
							</div>
							<button
								onClick={onClose}
								type="button"
								className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] hover:bg-[color:var(--hover)] transition-colors"
								aria-label="Cerrar"
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
									<path d="M18 6 6 18" />
									<path d="M6 6 18 18" />
								</svg>
							</button>
						</div>

						<div className="mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-1">
							<div className="grid grid-cols-2 gap-1">
								<button
									type="button"
									onClick={() => setMode('login')}
									className={
										'rounded-lg py-2 text-sm font-semibold transition-colors ' +
										(mode === 'login'
											? 'bg-[color:var(--surface-2)] text-[color:var(--text-h)] shadow-[var(--shadow)]'
											: 'text-[color:var(--text)] hover:bg-[color:var(--hover)]')
									}
								>
									Iniciar sesión
								</button>
								<button
									type="button"
									onClick={() => setMode('register')}
									className={
										'rounded-lg py-2 text-sm font-semibold transition-colors ' +
										(mode === 'register'
											? 'bg-[color:var(--surface-2)] text-[color:var(--text-h)] shadow-[var(--shadow)]'
											: 'text-[color:var(--text)] hover:bg-[color:var(--hover)]')
									}
								>
									Registrar
								</button>
							</div>
						</div>

						<div className="mt-4 min-h-[520px]">
							{mode === 'login' ? (
								<AuthView onLoggedIn={onLoggedIn} />
							) : (
								<RegisterView onRegistered={onLoggedIn} />
							)}
						</div>
					</Panel>
				</div>
			</div>
		</div>
	)
}
