import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockApi = jest.fn()
jest.mock('../../../../lib/api', () => ({ api: (...args) => mockApi(...args) }))

// Evita cargar imagen grande en el test.
jest.mock('../../MapView', () => ({
	MapView: () => <div data-testid="map-view">map</div>,
}))

import { ClientMapModule } from '../ClientMapModule'

describe('ClientMapModule', () => {
	beforeEach(() => {
		mockApi.mockReset()
	})

	test('si no hay sesión, muestra mensaje', () => {
		render(<ClientMapModule me={null} selected={null} onSelect={() => {}} />)
		expect(screen.getByText(/Inicia sesión para ver tus difuntos/i)).toBeInTheDocument()
	})

	test('carga difuntos desde reservas y permite seleccionar', async () => {
		mockApi.mockResolvedValueOnce({
			ok: true,
			status: 200,
			data: {
				reservations: [
					{ id: 1, deceased_full_name: 'Juan Pérez', reservation_code: 'RSV-1' },
				],
			},
		})

		const onSelect = jest.fn()
		render(<ClientMapModule me={{ id: 1, role: 'client' }} selected={null} onSelect={onSelect} />)

		await waitFor(() => {
			expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
		})

		await userEvent.click(screen.getByRole('button', { name: /Juan Pérez/i }))
		expect(onSelect).toHaveBeenCalled()
		expect(screen.getByTestId('map-view')).toBeInTheDocument()
	})
})
