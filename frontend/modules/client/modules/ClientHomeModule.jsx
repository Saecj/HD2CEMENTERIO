import { HomeView } from '../../home/HomeView'

export function ClientHomeModule({
	me,
	onLogin,
	onPayReservation,
	onGoToMyReservations,
	onGoToSearch,
	onGoToGraveStatus,
	onGoToPayments,
}) {
	return (
		<HomeView
			me={me}
			onLogin={onLogin}
			onPayReservation={onPayReservation}
			onGoToMyReservations={onGoToMyReservations}
			onGoToSearch={onGoToSearch}
			onGoToGraveStatus={onGoToGraveStatus}
			onGoToPayments={onGoToPayments}
		/>
	)
}
