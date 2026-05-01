import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('../../../layout/Panel', () => ({
	Panel: ({ children }) => <div data-testid="panel">{children}</div>,
}))

const mockSearchView = jest.fn(({ onGoToMap }) => (
	<div>
		<div data-testid="search-view">search</div>
		<button type="button" onClick={() => onGoToMap?.()}>Ir al mapa</button>
	</div>
))

jest.mock('../../../cemetery/SearchView', () => ({
	SearchView: (props) => mockSearchView(props),
}))

import { ClientSearchModule } from '../ClientSearchModule'

describe('ClientSearchModule', () => {
	test('si requireLogin y no hay sesión, muestra mensaje', () => {
		render(
			<ClientSearchModule
				me={null}
				requireLogin={true}
				selectedKey={null}
				onSelect={() => {}}
				onGoToMap={() => {}}
				searchSeed={0}
			/>,
		)

		expect(screen.getByTestId('panel')).toBeInTheDocument()
		expect(screen.getByText(/Inicia sesión desde la barra superior/i)).toBeInTheDocument()
		expect(mockSearchView).not.toHaveBeenCalled()
	})

	test('si hay sesión, renderiza SearchView y permite usar onGoToMap', async () => {
		const onGoToMap = jest.fn()
		render(
			<ClientSearchModule
				me={{ id: 1, role: 'client' }}
				requireLogin={true}
				selectedKey={'k1'}
				onSelect={() => {}}
				onGoToMap={onGoToMap}
				searchSeed={123}
			/>,
		)

		expect(screen.getByTestId('search-view')).toBeInTheDocument()
		expect(mockSearchView).toHaveBeenCalled()

		await userEvent.click(screen.getByRole('button', { name: /Ir al mapa/i }))
		expect(onGoToMap).toHaveBeenCalled()
	})
})
