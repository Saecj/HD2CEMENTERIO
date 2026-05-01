import { useMemo, useState } from 'react'
import { api } from '../../lib/api'

export function AuthView({ onLoggedIn }) {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')

	function isEmailOk(value) {
		const v = String(value || '').trim()
		return /.+@.+\..+/.test(v)
	}

	function formatError(code) {
		switch (code) {
			case 'INVALID_INPUT':
				return 'Completa tu correo y contraseña.'
			case 'INVALID_CREDENTIALS':
				return 'Correo o contraseña incorrectos.'
			case 'EMAIL_NOT_VERIFIED':
				return 'Tu correo aún no está verificado.'
			default:
				return code || 'No se pudo iniciar sesión.'
		}
	}

	const canSubmit = useMemo(() => isEmailOk(email) && password.length > 0, [email, password])

	async function onSubmit(e) {
		e?.preventDefault()
		setLoading(true)
		setError('')
		try {
			const result = await api('/api/auth/login', {
				method: 'POST',
				body: JSON.stringify({ email, password }),
			})
			if (!result.ok) {
				setError(formatError(result.data?.error))
				return
			}
			onLoggedIn?.(result.data?.user)
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="mx-auto w-full max-w-md">
			<form className="space-y-4" onSubmit={onSubmit}>
				<div>
					<label className="block text-sm text-[color:var(--text)]">Correo</label>
					<div className="relative mt-1">
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
							<path d="M4 4h16v16H4z" opacity="0" />
							<path d="M4 6h16" />
							<path d="m4 6 8 7 8-7" />
							<path d="M4 18h16" />
						</svg>
						<input
							type="email"
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] py-3 pl-10 pr-3 text-sm text-[color:var(--text-h)] outline-none transition-colors focus:border-[color:var(--accent-border)]"
							placeholder="tu@correo.com"
						/>
					</div>
				</div>

				<div>
					<label className="block text-sm text-[color:var(--text)]">Contraseña</label>
					<div className="relative mt-1">
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
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
							<path d="M7 11V7a5 5 0 0 1 10 0v4" />
						</svg>
						<input
							type={showPassword ? 'text' : 'password'}
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] py-3 pl-10 pr-14 text-sm text-[color:var(--text-h)] outline-none transition-colors focus:border-[color:var(--accent-border)]"
							placeholder="********"
						/>
						<button
							type="button"
							onClick={() => setShowPassword((v) => !v)}
							className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-2)] p-2 text-[color:var(--text)] hover:bg-[color:var(--hover)] transition-colors"
							aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
						>
							{showPassword ? (
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
									<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94" />
									<path d="M1 1l22 22" />
									<path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-4.87 6.57" />
									<path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
								</svg>
							) : (
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
									<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
									<circle cx="12" cy="12" r="3" />
								</svg>
							)}
						</button>
					</div>
				</div>

				{error && <p className="text-sm text-red-600">{error}</p>}

				<button
					disabled={!canSubmit || loading}
					className="w-full rounded-xl bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
				>
					{loading ? 'Ingresando…' : 'Ingresar'}
				</button>
			</form>
		</div>
	)
}
