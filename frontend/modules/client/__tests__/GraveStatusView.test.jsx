import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

const mockApi = jest.fn()
jest.mock('../../../lib/api', () => ({ api: (...args) => mockApi(...args) }))

import { GraveStatusView } from '../GraveStatusView'

describe('GraveStatusView', () => {
	beforeEach(() => {
		mockApi.mockReset()
	})

	test('si no hay sesión, pide iniciar sesión', () => {
		render(<GraveStatusView me={null} selected={null} onGoToMap={() => {}} />)
		expect(screen.getByText(/Inicia sesión para consultar el estado/i)).toBeInTheDocument()
	})

	test('carga reservas y pagos y renderiza estado', async () => {
		mockApi
			.mockResolvedValueOnce({ ok: true, status: 200, data: { reservations: [{ id: 1, deceased_full_name: 'Juan', reservation_code: 'RSV-1', grave_code: 't-1', sector_name: 'A', row_number: 1, col_number: 2, status: 'confirmed', grave_status: 'reserved' }] } })
			.mockResolvedValueOnce({ ok: true, status: 200, data: { payments: [{ id: 9, reservation_code: 'RSV-1', status: 'paid' }] } })

		render(<GraveStatusView me={{ id: 1, role: 'client' }} selected={null} onGoToMap={() => {}} />)

		await waitFor(() => {
			expect(screen.getByText(/Estado actual/i)).toBeInTheDocument()
			expect(screen.getByText(/Juan/i)).toBeInTheDocument()
		})

		expect(screen.getByRole('button', { name: /Ver mapa/i })).toBeInTheDocument()
	})
})
