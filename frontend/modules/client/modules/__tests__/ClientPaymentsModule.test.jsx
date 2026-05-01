import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('../../../layout/Panel', () => ({
	Panel: ({ children }) => <div data-testid="panel">{children}</div>,
}))

const mockMyPaymentsView = jest.fn(() => <div data-testid="my-payments">pay</div>)

jest.mock('../../MyPaymentsView', () => ({
	MyPaymentsView: (props) => mockMyPaymentsView(props),
}))

import { ClientPaymentsModule } from '../ClientPaymentsModule'

describe('ClientPaymentsModule', () => {
	test('renderiza Panel + MyPaymentsView y pasa props', () => {
		const onLogin = jest.fn()
		const onIntentHandled = jest.fn()
		const me = { id: 1, role: 'client' }
		const intent = { kind: 'pay', reservationId: 1 }

		render(
			<ClientPaymentsModule
				me={me}
				onLogin={onLogin}
				intent={intent}
				onIntentHandled={onIntentHandled}
				filterSeed={1}
			/>,
		)

		expect(screen.getByTestId('panel')).toBeInTheDocument()
		expect(screen.getByTestId('my-payments')).toBeInTheDocument()
		expect(mockMyPaymentsView).toHaveBeenCalled()
		const props = mockMyPaymentsView.mock.calls[0][0]
		expect(props.me).toBe(me)
		expect(props.onLogin).toBe(onLogin)
		expect(props.intent).toBe(intent)
		expect(props.onIntentHandled).toBe(onIntentHandled)
		expect(props.filterSeed).toBe(1)
	})
})
