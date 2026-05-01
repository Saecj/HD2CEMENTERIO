import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockApi = jest.fn()
jest.mock('../../../../lib/api', () => ({ api: (...args) => mockApi(...args) }))

import { ClientProfileModule } from '../ClientProfileModule'

describe('ClientProfileModule', () => {
	beforeEach(() => {
		mockApi.mockReset()
	})

	test('si no hay sesión y showLoggedOutMessage, muestra mensaje', () => {
		render(<ClientProfileModule me={null} showLoggedOutMessage onLogout={() => {}} onMeRefresh={() => {}} />)
		expect(screen.getByText(/Inicia sesión o regístrate/i)).toBeInTheDocument()
	})

	test('renderiza perfil y permite abrir edición', async () => {
		mockApi.mockImplementation(async (path, options) => {
			if (path === '/api/client/profile' && (!options || options.method === 'GET')) {
				return { ok: true, status: 200, data: { client: { full_name: 'Cliente Uno', document_id: '123', phone: '999' } } }
			}
			if (path === '/api/client/reservations') {
				return { ok: true, status: 200, data: { reservations: [] } }
			}
			if (path === '/api/client/profile' && options?.method === 'PUT') {
				return { ok: true, status: 200, data: { client: { full_name: 'Cliente Uno', document_id: '123', phone: '999' } } }
			}
			return { ok: true, status: 200, data: {} }
		})

		const onMeRefresh = jest.fn()
		render(
			<ClientProfileModule
				me={{ id: 1, role: 'client', email: 'c@x.com', username: 'cliente' }}
				showLoggedOutMessage={false}
				onLogout={() => {}}
				onMeRefresh={onMeRefresh}
			/>,
		)

		await waitFor(() => {
			expect(screen.getByText(/Perfil/i)).toBeInTheDocument()
			expect(screen.getAllByText('c@x.com').length).toBeGreaterThan(0)
		})

		await userEvent.click(screen.getByRole('button', { name: /Editar/i }))
		expect(screen.getByRole('button', { name: /Guardar/i })).toBeInTheDocument()

		// Guardar sin cambiar nada (smoke)
		await userEvent.click(screen.getByRole('button', { name: /Guardar/i }))
		await waitFor(() => {
			expect(onMeRefresh).toHaveBeenCalled()
		})
	})
})
