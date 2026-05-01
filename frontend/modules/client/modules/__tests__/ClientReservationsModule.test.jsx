import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('../../../layout/Panel', () => ({
	Panel: ({ children }) => <div data-testid="panel">{children}</div>,
}))

const mockMyReservationsView = jest.fn(() => <div data-testid="my-reservations">resv</div>)

jest.mock('../../MyReservationsView', () => ({
	MyReservationsView: (props) => mockMyReservationsView(props),
}))

import { ClientReservationsModule } from '../ClientReservationsModule'

describe('ClientReservationsModule', () => {
	test('renderiza Panel + MyReservationsView y pasa props', () => {
		const onLogin = jest.fn()
		const onPayReservation = jest.fn()
		const me = { id: 1, role: 'client' }

		render(
			<ClientReservationsModule me={me} onLogin={onLogin} onPayReservation={onPayReservation} filterSeed={99} />,
		)

		expect(screen.getByTestId('panel')).toBeInTheDocument()
		expect(screen.getByTestId('my-reservations')).toBeInTheDocument()
		expect(mockMyReservationsView).toHaveBeenCalled()
		const props = mockMyReservationsView.mock.calls[0][0]
		expect(props.me).toBe(me)
		expect(props.onLogin).toBe(onLogin)
		expect(props.onPayReservation).toBe(onPayReservation)
		expect(props.filterSeed).toBe(99)
	})
})
