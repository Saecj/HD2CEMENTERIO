import { Panel } from '../../layout/Panel'
import { MyReservationsView } from '../MyReservationsView'

export function ClientReservationsModule({ me, onLogin, onPayReservation, filterSeed }) {
	return (
		<Panel>
			<MyReservationsView me={me} onLogin={onLogin} onPayReservation={onPayReservation} filterSeed={filterSeed} />
		</Panel>
	)
}
