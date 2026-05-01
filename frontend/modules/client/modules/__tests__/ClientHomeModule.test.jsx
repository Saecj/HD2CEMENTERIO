import React from 'react'
import { render, screen } from '@testing-library/react'

const mockHomeView = jest.fn(() => <div data-testid="home-view">home</div>)

jest.mock('../../../home/HomeView', () => ({
	HomeView: (props) => mockHomeView(props),
}))

import { ClientHomeModule } from '../ClientHomeModule'

describe('ClientHomeModule', () => {
	test('renderiza HomeView y pasa props', () => {
		const onLogin = jest.fn()
		const onPayReservation = jest.fn()
		const onGoToMyReservations = jest.fn()
		const me = { id: 1, role: 'client' }

		render(
			<ClientHomeModule
				me={me}
				onLogin={onLogin}
				onPayReservation={onPayReservation}
				onGoToMyReservations={onGoToMyReservations}
			/>,
		)

		expect(screen.getByTestId('home-view')).toBeInTheDocument()
		expect(mockHomeView).toHaveBeenCalled()
		const props = mockHomeView.mock.calls[0][0]
		expect(props.me).toBe(me)
		expect(props.onLogin).toBe(onLogin)
		expect(props.onPayReservation).toBe(onPayReservation)
		expect(props.onGoToMyReservations).toBe(onGoToMyReservations)
	})
})
