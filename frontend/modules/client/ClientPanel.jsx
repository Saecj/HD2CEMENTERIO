import { TabButton } from '../layout/TabButton'

import { ClientGraveStatusModule } from './modules/ClientGraveStatusModule'
import { ClientHomeModule } from './modules/ClientHomeModule'
import { ClientMapModule } from './modules/ClientMapModule'
import { ClientPaymentsModule } from './modules/ClientPaymentsModule'
import { ClientProfileModule } from './modules/ClientProfileModule'
import { ClientReservationsModule } from './modules/ClientReservationsModule'
import { ClientSearchModule } from './modules/ClientSearchModule'

export function ClientPanel({
	me,
	clientTabs,
	activeTab,
	onTabChange,
	showTabHeader,
	requireLoginForSearch,
	clientSelected,
	clientSelectedKey,
	onSelect,
	onLogin,
	onLogout,
	onMeRefresh,
	onPayReservation,
	paymentIntent,
	onPaymentIntentHandled,
	searchSeed,
	reservationsSeed,
	paymentsSeed,
}) {
	return (
		<>
			{showTabHeader ? (
				<div className="mb-4 flex flex-wrap gap-1">
					{clientTabs.map((t) => (
						<TabButton key={t.id} active={activeTab === t.id} onClick={() => onTabChange(t.id)}>
							{t.label}
						</TabButton>
					))}
				</div>
			) : null}

			{activeTab === 'home' && (
				<ClientHomeModule
					me={me}
					onLogin={onLogin}
					onPayReservation={onPayReservation}
					onGoToMyReservations={() => onTabChange('reservations')}
					onGoToSearch={() => onTabChange('search')}
					onGoToGraveStatus={() => onTabChange('graveStatus')}
					onGoToPayments={() => onTabChange('payments')}
				/>
			)}

			{activeTab === 'search' && (
				<ClientSearchModule
					me={me}
					requireLogin={requireLoginForSearch}
					selectedKey={clientSelectedKey}
					onSelect={onSelect}
					onGoToMap={() => onTabChange('map')}
					searchSeed={searchSeed}
				/>
			)}


			{activeTab === 'map' && <ClientMapModule me={me} selected={clientSelected} onSelect={onSelect} />}

			{activeTab === 'graveStatus' && (
				<ClientGraveStatusModule me={me} selected={clientSelected} onGoToMap={() => onTabChange('map')} />
			)}

			{activeTab === 'reservations' && (
				<ClientReservationsModule
					me={me}
					onLogin={onLogin}
					onPayReservation={onPayReservation}
					filterSeed={reservationsSeed}
				/>
			)}

			{activeTab === 'payments' && (
				<ClientPaymentsModule
					me={me}
					onLogin={onLogin}
					intent={paymentIntent}
					onIntentHandled={onPaymentIntentHandled}
					filterSeed={paymentsSeed}
				/>
			)}

			{activeTab === 'profile' && (
				<ClientProfileModule
					me={me}
					showLoggedOutMessage={!me && !showTabHeader}
					onLogout={onLogout}
					onMeRefresh={onMeRefresh}
				/>
			)}
		</>
	)
}
