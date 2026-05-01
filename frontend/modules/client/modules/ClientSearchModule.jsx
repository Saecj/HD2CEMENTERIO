import { Panel } from '../../layout/Panel'
import { SearchView } from '../../cemetery/SearchView'

export function ClientSearchModule({ me, requireLogin, selectedKey, onSelect, onGoToMap, searchSeed }) {
	return (
		<Panel>
			{requireLogin && !me ? (
				<div className="text-sm text-[color:var(--text)]">Inicia sesión desde la barra superior para buscar difuntos.</div>
			) : (
				<SearchView selectedKey={selectedKey} onSelect={onSelect} onGoToMap={onGoToMap} searchSeed={searchSeed} />
			)}
		</Panel>
	)
}
