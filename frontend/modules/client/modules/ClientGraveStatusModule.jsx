import { Panel } from '../../layout/Panel'
import { GraveStatusView } from '../GraveStatusView'

export function ClientGraveStatusModule({ me, selected, onGoToMap }) {
	return (
		<Panel>
			<GraveStatusView me={me} selected={selected} onGoToMap={onGoToMap} />
		</Panel>
	)
}
