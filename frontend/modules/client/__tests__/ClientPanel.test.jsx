import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('../../layout/TabButton', () => ({
	TabButton: ({ children, onClick }) => (
		<button type="button" onClick={onClick}>
			{children}
		</button>
	),
}))

jest.mock('../modules/ClientHomeModule', () => ({
	ClientHomeModule: () => <div data-testid="mod-home">home</div>,
}))

jest.mock('../modules/ClientSearchModule', () => ({
	ClientSearchModule: () => <div data-testid="mod-search">search</div>,
}))

jest.mock('../modules/ClientMapModule', () => ({
	ClientMapModule: () => <div data-testid="mod-map">map</div>,
}))

jest.mock('../modules/ClientGraveStatusModule', () => ({
	ClientGraveStatusModule: () => <div data-testid="mod-status">status</div>,
}))

jest.mock('../modules/ClientReservationsModule', () => ({
	ClientReservationsModule: () => <div data-testid="mod-resv">reservations</div>,
}))

jest.mock('../modules/ClientPaymentsModule', () => ({
	ClientPaymentsModule: () => <div data-testid="mod-pay">payments</div>,
}))

jest.mock('../modules/ClientProfileModule', () => ({
	ClientProfileModule: () => <div data-testid="mod-prof">profile</div>,
}))

import { ClientPanel } from '../ClientPanel'

const baseTabs = [
	{ id: 'home', label: 'Inicio' },
	{ id: 'search', label: 'Búsqueda' },
	{ id: 'map', label: 'Mapa' },
	{ id: 'graveStatus', label: 'Estado' },
	{ id: 'reservations', label: 'Mis reservas' },
	{ id: 'payments', label: 'Pagos' },
	{ id: 'profile', label: 'Perfil' },
]

describe('ClientPanel', () => {
	test('renderiza el módulo correspondiente según activeTab', () => {
		const { rerender } = render(
			<ClientPanel
				me={null}
				clientTabs={baseTabs}
				activeTab="home"
				onTabChange={() => {}}
				showTabHeader
				requireLoginForSearch={false}
				clientSelected={null}
				clientSelectedKey=""
				onSelect={() => {}}
				onLogin={() => {}}
				onLogout={() => {}}
				onMeRefresh={() => {}}
				onPayReservation={() => {}}
				paymentIntent={null}
				onPaymentIntentHandled={() => {}}
				searchSeed={{ q: '', ts: 0 }}
				reservationsSeed={{ q: '', ts: 0 }}
				paymentsSeed={{ q: '', ts: 0 }}
			/>,
		)

		expect(screen.getByTestId('mod-home')).toBeInTheDocument()

		rerender(
			<ClientPanel
				me={null}
				clientTabs={baseTabs}
				activeTab="search"
				onTabChange={() => {}}
				showTabHeader
				requireLoginForSearch={false}
				clientSelected={null}
				clientSelectedKey=""
				onSelect={() => {}}
				onLogin={() => {}}
				onLogout={() => {}}
				onMeRefresh={() => {}}
				onPayReservation={() => {}}
				paymentIntent={null}
				onPaymentIntentHandled={() => {}}
				searchSeed={{ q: '', ts: 0 }}
				reservationsSeed={{ q: '', ts: 0 }}
				paymentsSeed={{ q: '', ts: 0 }}
			/>,
		)
		expect(screen.getByTestId('mod-search')).toBeInTheDocument()
	})
})
