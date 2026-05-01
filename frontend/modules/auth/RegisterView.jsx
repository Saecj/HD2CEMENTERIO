import { useMemo, useState } from 'react'
import { api } from '../../lib/api'

export function RegisterView({ onRegistered }) {
	const [step, setStep] = useState('form') // form | verify
	const [verifyCode, setVerifyCode] = useState('')
	const [username, setUsername] = useState('')
	const [email, setEmail] = useState('')
	const [documentId, setDocumentId] = useState('')
	const [phone, setPhone] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [acceptTerms, setAcceptTerms] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [info, setInfo] = useState('')

	function onlyDigits(value, maxLen) {
		const digits = String(value || '').replace(/\D+/g, '')
		return typeof maxLen === 'number' ? digits.slice(0, maxLen) : digits
	}

	function isEmailOk(value) {
		const v = String(value || '').trim()
		return /.+@.+\..+/.test(v)
	}

	function formatError(code) {
		switch (code) {
			case 'USERNAME_REQUIRED':
				return 'El usuario es obligatorio.'
			case 'USERNAME_INVALID':
				return 'El usuario debe tener entre 2 y 24 caracteres.'
			case 'EMAIL_INVALID':
				return 'Ingresa un correo válido (debe incluir @ y .).'
			case 'DNI_REQUIRED':
				return 'El DNI es obligatorio.'
			case 'DNI_INVALID':
				return 'El DNI debe tener exactamente 7 dígitos.'
			case 'PHONE_INVALID':
				return 'El celular debe tener exactamente 9 dígitos.'
			case 'TERMS_REQUIRED':
				return 'Debes aceptar los términos y condiciones.'
			case 'PASSWORD_MISMATCH':
				return 'Las contraseñas no coinciden.'
			case 'PASSWORD_WEAK':
				return 'La contraseña no cumple los requisitos.'
			case 'EMAIL_ALREADY_REGISTERED':
				return 'Este correo ya está registrado.'
			case 'CODE_INVALID_OR_EXPIRED':
				return 'El código es inválido o ya venció.'
			case 'INVALID_INPUT':
				return 'Datos inválidos.'
			default:
				return code || 'Ocurrió un error.'
		}
	}

	const passwordHint = useMemo(() => {
		const hasUpper = /[A-Z]/.test(password)
		const hasNum = /[0-9]/.test(password)
		const hasSpecial = /[^A-Za-z0-9]/.test(password)
		const hasLen = password.length >= 8
		const ok = hasUpper && hasNum && hasSpecial && hasLen
		return {
			ok,
			items: [
				'Mínimo 8 caracteres',
				'Una mayúscula (A-Z)',
				'Un número (0-9)',
				'Un símbolo (!@#...)',
			],
		}
	}, [password])

	const canSubmit = useMemo(
		() => {
			if (step !== 'form') return false
			if (username.trim().length < 2 || username.trim().length > 24) return false
			if (!isEmailOk(email)) return false
			if (documentId.trim().length !== 7) return false
			if (!password) return false
			if (password !== confirmPassword) return false
			if (!acceptTerms) return false
			if (!passwordHint.ok) return false
			if (phone.trim() && phone.trim().length !== 9) return false
			return true
		},
		[step, username, email, documentId, phone, password, confirmPassword, acceptTerms, passwordHint.ok],
	)

	const canVerify = useMemo(() => {
		if (step !== 'verify') return false
		return isEmailOk(email) && verifyCode.trim().length >= 4
	}, [step, email, verifyCode])

	async function onSubmit(e) {
		e?.preventDefault()
		setLoading(true)
		setError('')
		setInfo('')
		try {
			const result = await api('/api/auth/register', {
				method: 'POST',
				body: JSON.stringify({
					username: username.trim(),
					email,
					documentId,
					phone: phone.trim() ? phone.trim() : null,
					password,
					confirmPassword,
					acceptTerms,
				}),
			})
			if (!result.ok) {
				setError(formatError(result.data?.error))
				return
			}
			setInfo('Te enviamos un código para verificar tu correo.')
			setStep('verify')
		} finally {
			setLoading(false)
		}
	}

	async function onVerify(e) {
		e?.preventDefault()
		setLoading(true)
		setError('')
		setInfo('')
		try {
			const result = await api('/api/auth/verify-email', {
				method: 'POST',
				body: JSON.stringify({ email, code: verifyCode.trim() }),
			})
			if (!result.ok) {
				setError(formatError(result.data?.error))
				return
			}
			onRegistered?.(result.data?.user)
		} finally {
			setLoading(false)
		}
	}

	if (step === 'verify') {
		return (
			<div className="mx-auto w-full max-w-md">
				<form className="space-y-4" onSubmit={onVerify}>
					<div className="text-sm text-[color:var(--text-h)]">Verifica tu correo</div>
					<p className="text-sm text-[color:var(--text)]/80">
						Ingresa el código que enviamos a <span className="font-medium text-[color:var(--text-h)]">{email}</span>.
					</p>

					<div>
						<label className="block text-sm text-[color:var(--text)]">Código</label>
						<input
							value={verifyCode}
							onChange={(e) => setVerifyCode(onlyDigits(e.target.value, 6))}
							className="mt-1 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3 text-sm text-[color:var(--text-h)] outline-none transition-colors focus:border-[color:var(--accent-border)]"
							placeholder="123456"
							inputMode="numeric"
							maxLength={6}
						/>
					</div>

					{error && <p className="text-sm text-red-600">{error}</p>}
					{info && <p className="text-sm text-[color:var(--text)]">{info}</p>}

					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => {
								setStep('form')
								setVerifyCode('')
								setError('')
								setInfo('')
							}}
							className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3 text-sm font-medium hover:bg-[color:var(--hover)] transition-colors"
						>
							Atrás
						</button>
						<button
							disabled={!canVerify || loading}
							className="w-full rounded-xl bg-[color:var(--accent)] px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
						>
							{loading ? 'Verificando…' : 'Verificar'}
						</button>
					</div>
				</form>
			</div>
		)
	}

	return (
		<div className="mx-auto w-full max-w-md">
			<form className="space-y-4" onSubmit={onSubmit}>
				<div>
					<label className="block text-sm text-[color:var(--text)]">Usuario</label>
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
							<path d="M20 21a8 8 0 0 0-16 0" />
							<circle cx="12" cy="7" r="4" />
						</svg>
						<input
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] py-3 pl-10 pr-3 text-sm text-[color:var(--text-h)] outline-none transition-colors focus:border-[color:var(--accent-border)]"
							placeholder="Ej: JuanP"
							autoComplete="username"
							maxLength={24}
						/>
					</div>
					<div className="mt-1 text-xs text-[color:var(--muted)]">Se mostrará en la barra superior (2–24 caracteres).</div>
				</div>

				<div>
					<label className="block text-sm text-[color:var(--text)]">DNI</label>
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
							<path d="M8 7h8" />
							<path d="M8 11h8" />
							<path d="M8 15h5" />
						</svg>
						<input
							value={documentId}
							onChange={(e) => setDocumentId(onlyDigits(e.target.value, 7))}
							className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] py-3 pl-10 pr-3 text-sm text-[color:var(--text-h)] outline-none transition-colors focus:border-[color:var(--accent-border)]"
							placeholder="Ej: 9998887"
							inputMode="numeric"
							maxLength={7}
						/>
					</div>
				</div>

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
					<label className="block text-sm text-[color:var(--text)]">Celular (opcional)</label>
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
							<path d="M22 16.92V21a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 1 4.18 2 2 0 0 1 3 2h4.09a2 2 0 0 1 2 1.72c.12.81.3 1.6.54 2.36a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.72-1.27a2 2 0 0 1 2.11-.45c.76.24 1.55.42 2.36.54A2 2 0 0 1 22 16.92z" />
						</svg>
						<input
							type="tel"
							autoComplete="tel"
							value={phone}
							onChange={(e) => setPhone(onlyDigits(e.target.value, 9))}
							className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] py-3 pl-10 pr-3 text-sm text-[color:var(--text-h)] outline-none transition-colors focus:border-[color:var(--accent-border)]"
							placeholder="999999999"
							inputMode="numeric"
							maxLength={9}
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
							autoComplete="new-password"
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
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94" />
									<path d="M1 1l22 22" />
									<path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-4.87 6.57" />
									<path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
								</svg>
							) : (
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
									<circle cx="12" cy="12" r="3" />
								</svg>
							)}
						</button>
					</div>
					<ul className="mt-2 space-y-1 text-xs text-[color:var(--text)]/75">
						{passwordHint.items.map((item) => (
							<li key={item} className={passwordHint.ok ? 'text-[color:var(--accent)]' : undefined}>
								• {item}
							</li>
						))}
					</ul>
				</div>

				<div>
					<label className="block text-sm text-[color:var(--text)]">Confirmar contraseña</label>
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
							type={showConfirmPassword ? 'text' : 'password'}
							autoComplete="new-password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] py-3 pl-10 pr-14 text-sm text-[color:var(--text-h)] outline-none transition-colors focus:border-[color:var(--accent-border)]"
							placeholder="********"
						/>
						<button
							type="button"
							onClick={() => setShowConfirmPassword((v) => !v)}
							className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-2)] p-2 text-[color:var(--text)] hover:bg-[color:var(--hover)] transition-colors"
							aria-label={showConfirmPassword ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
						>
							{showConfirmPassword ? (
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94" />
									<path d="M1 1l22 22" />
									<path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-4.87 6.57" />
									<path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
								</svg>
							) : (
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
									<circle cx="12" cy="12" r="3" />
								</svg>
							)}
						</button>
					</div>
				</div>

				<label className="flex items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3 text-sm text-[color:var(--text)]">
					<input
						type="checkbox"
						checked={acceptTerms}
						onChange={(e) => setAcceptTerms(e.target.checked)}
						className="mt-1"
					/>
					<span>Acepto los términos y condiciones</span>
				</label>

				{error && <p className="text-sm text-red-600">{error}</p>}
				{info && <p className="text-sm text-[color:var(--text)]">{info}</p>}

				<button
					disabled={!canSubmit || loading}
					className="w-full rounded-xl bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
				>
					{loading ? 'Enviando…' : 'Enviar código'}
				</button>
			</form>
		</div>
	)
}
