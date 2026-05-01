import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

const mockApi = jest.fn()
jest.mock('../../../lib/api', () => ({ api: (...args) => mockApi(...args) }))

import { MyPaymentsView } from '../MyPaymentsView'

describe('MyPaymentsView', () => {
	beforeEach(() => {
		mockApi.mockReset()
	})

	test('si no hay sesión, pide iniciar sesión', () => {
		render(<MyPaymentsView me={null} onLogin={() => {}} />)
		expect(screen.getByText(/Inicia sesión para ver tus pagos/i)).toBeInTheDocument()
	})

	test('renderiza pagos y botón Pagar (con mocks de API)', async () => {
		mockApi.mockImplementation(async (path) => {
			if (String(path).startsWith('/api/client/payments')) {
				return {
					ok: true,
					status: 200,
					data: { payments: [{ id: 1, reservation_code: 'RSV-001', grave_code: 't-0009', payment_type_name: 'Efectivo', amount_cents: 20000, currency: 'PEN', status: 'pending', created_at: new Date().toISOString() }] },
				}
			}
			if (String(path).startsWith('/api/payment-types')) {
				return {
					ok: true,
					status: 200,
					data: { paymentTypes: [{ id: 1, name: 'cash' }] },
				}
			}
			return { ok: true, status: 200, data: {} }
		})

		render(
			<MyPaymentsView
				me={{ id: 10, role: 'client', email: 'c@x.com' }}
				onLogin={() => {}}
				intent={null}
				onIntentHandled={() => {}}
				filterSeed={{ q: '', ts: 0 }}
			/>,
		)

		await waitFor(() => {
			expect(screen.getByText(/Mis pagos/i)).toBeInTheDocument()
		})

		expect(screen.getByRole('button', { name: /^Pagar$/i })).toBeInTheDocument()
	})
})
