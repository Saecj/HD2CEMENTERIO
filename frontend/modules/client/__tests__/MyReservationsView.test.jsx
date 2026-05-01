import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

const mockApi = jest.fn()
jest.mock('../../../lib/api', () => ({ api: (...args) => mockApi(...args) }))

import { MyReservationsView } from '../MyReservationsView'

describe('MyReservationsView', () => {
	beforeEach(() => {
		mockApi.mockReset()
	})

	test('si no hay sesión, pide iniciar sesión', () => {
		render(<MyReservationsView me={null} onLogin={() => {}} />)
		expect(screen.getByText(/Inicia sesión para ver tus reservas/i)).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Iniciar sesión/i })).toBeInTheDocument()
	})

	test('carga y muestra reservas del cliente', async () => {
		mockApi.mockResolvedValueOnce({
			ok: true,
			status: 200,
			data: {
				reservations: [
					{
						id: 1,
						reservation_code: 'RSV-001',
						grave_code: 't-0009',
						sector_name: 'A',
						row_number: 1,
						col_number: 2,
						deceased_full_name: 'Juan Pérez',
						status: 'pending',
						created_at: new Date().toISOString(),
						price_cents: 20000,
						paid_cents: 0,
						pending_cents: 0,
						due_cents: 0,
					},
				],
			},
		})

		render(
			<MyReservationsView
				me={{ id: 10, role: 'client', email: 'c@x.com' }}
				onLogin={() => {}}
				onPayReservation={() => {}}
				filterSeed={{ q: '', ts: 0 }}
			/>,
		)

		expect(screen.getByText(/Mis reservas/i)).toBeInTheDocument()

		await waitFor(() => {
			expect(screen.getByText('RSV-001')).toBeInTheDocument()
			expect(screen.getByText('t-0009')).toBeInTheDocument()
		})
	})
})
