import { Panel } from '../../layout/Panel'
import { MyPaymentsView } from '../MyPaymentsView'

export function ClientPaymentsModule({ me, onLogin, intent, onIntentHandled, filterSeed }) {
	return (
		<Panel>
			<MyPaymentsView
				me={me}
				onLogin={onLogin}
				intent={intent}
				onIntentHandled={onIntentHandled}
				filterSeed={filterSeed}
			/>
		</Panel>
	)
}
