import React from 'react'
import { render, screen } from '@testing-library/react'

import { MapView } from '../MapView'

describe('MapView', () => {
	test('renderiza mensaje cuando no hay selección', () => {
		render(<MapView selected={null} markers={[]} onSelect={() => {}} />)
		expect(screen.getByText(/Mapa del cementerio/i)).toBeInTheDocument()
		expect(screen.getByText(/Selecciona un difunto/i)).toBeInTheDocument()
	})

	test('muestra link a Google Maps si hay coordenadas', () => {
		render(
			<MapView
				selected={{ deceased_full_name: 'Ana', latitude: -12.0, longitude: -77.0, grave_code: 't-0001' }}
				markers={[]}
				onSelect={() => {}}
			/>,
		)
		expect(screen.getByRole('link', { name: /Google Maps/i })).toBeInTheDocument()
	})
})
