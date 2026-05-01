import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('../../../layout/Panel', () => ({
	Panel: ({ children }) => <div data-testid="panel">{children}</div>,
}))

const mockGraveStatusView = jest.fn(({ onGoToMap }) => (
	<div>
		<div data-testid="grave-status-view">status</div>
		<button type="button" onClick={() => onGoToMap?.()}>Ver mapa</button>
	</div>
))

jest.mock('../../GraveStatusView', () => ({
	GraveStatusView: (props) => mockGraveStatusView(props),
}))

import { ClientGraveStatusModule } from '../ClientGraveStatusModule'

describe('ClientGraveStatusModule', () => {
	test('renderiza Panel + GraveStatusView y pasa props', async () => {
		const onGoToMap = jest.fn()
		const selected = { grave_id: 1 }
		const me = { id: 1, role: 'client' }

		render(<ClientGraveStatusModule me={me} selected={selected} onGoToMap={onGoToMap} />)

		expect(screen.getByTestId('panel')).toBeInTheDocument()
		expect(screen.getByTestId('grave-status-view')).toBeInTheDocument()
		expect(mockGraveStatusView).toHaveBeenCalled()

		const props = mockGraveStatusView.mock.calls[0][0]
		expect(props.me).toBe(me)
		expect(props.selected).toBe(selected)
		expect(props.onGoToMap).toBe(onGoToMap)

		await userEvent.click(screen.getByRole('button', { name: /Ver mapa/i }))
		expect(onGoToMap).toHaveBeenCalled()
	})
})
