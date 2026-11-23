import React, { useMemo, useState } from 'react';
import { Button, DataTable, SearchBar, StatePanel, Toolbar } from '@tdn/shared';
import { ApiError } from './Feedback';
import { useCharacterCatalog } from './CharacterCatalogContext';
import type { CatalogKind } from './catalogTypes';
import CharacterCatalogAddDialog from './CharacterCatalogAddDialog';
import CharacterCatalogEntryDialog from './CharacterCatalogEntryDialog';

export type CharacterCatalogPanelProps = {
  kind: CatalogKind;
  canPublishDefinition?: boolean;
  readOnly?: boolean;
  characterName?: string;
  audience?: 'gm' | 'player';
  definitionPermissionsPending?: boolean;
  onDefinitionForbidden?: () => void;
};

const CharacterCatalogPanel: React.FC<CharacterCatalogPanelProps> = ({ canPublishDefinition = false, readOnly = false, characterName, audience = 'player', definitionPermissionsPending = false, onDefinitionForbidden }) => {
  const catalog = useCharacterCatalog();
  const kind = catalog.kind;
  const [search, setSearch] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string>();
  const [adding, setAdding] = useState(false);
  const entries = useMemo(() => (catalog.entries ?? [])
    .filter(entry => entry.definition.kind === kind && entry.definition.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((left, right) => left.definition.name.localeCompare(right.definition.name)), [catalog.entries, kind, search]);
  const canAdd = catalog.canWrite && !readOnly;

  return <section aria-busy={catalog.loading}>
    <Toolbar><SearchBar searchTerm={search} onSearchChange={setSearch} compact aria-label="Поиск по названию" /></Toolbar>
    {canAdd && <Button type="button" onClick={() => setAdding(true)}>{kind === 'Item' ? 'Добавить предмет' : 'Добавить навык'}</Button>}
    {!catalog.canRead && !catalog.permissionsPending && <StatePanel kind="error">Доступ к записям этого персонажа не подтверждён.</StatePanel>}
    {catalog.canRead && catalog.loading && !catalog.entries && <StatePanel kind="loading">Загрузка записей персонажа…</StatePanel>}
    {Boolean(catalog.error) && <ApiError error={catalog.error} onRetry={catalog.reload} />}
    {catalog.entries && entries.length === 0 && <StatePanel kind="empty">Ничего не найдено</StatePanel>}
    {catalog.entries && entries.length > 0 && <DataTable aria-label={kind === 'Item' ? 'Инвентарь персонажа' : 'Навыки персонажа'} minWidth="24rem">
      <thead><tr><th scope="col">Название</th>{kind === 'Item' && <th scope="col">Количество</th>}</tr></thead>
      <tbody>{entries.map(entry => <tr key={entry.record.id}>
        <th scope="row"><Button type="button" variant="secondary" onClick={() => setSelectedEntryId(entry.record.id)}>{entry.definition.name}</Button></th>
        {kind === 'Item' && <td>{entry.record.quantity === null ? '—' : String(entry.record.quantity)}</td>}
      </tr>)}</tbody>
    </DataTable>}
    {selectedEntryId && <CharacterCatalogEntryDialog entryId={selectedEntryId} readOnly={readOnly || !catalog.canWrite} characterName={characterName} audience={audience} canAdminDefinition={canPublishDefinition} definitionPermissionsPending={definitionPermissionsPending} onDefinitionForbidden={onDefinitionForbidden} onClose={() => setSelectedEntryId(undefined)} />}
    {adding && <CharacterCatalogAddDialog kind={kind} canPublishDefinition={canPublishDefinition} characterName={characterName} definitionPermissionsPending={definitionPermissionsPending} onClose={() => setAdding(false)} />}
  </section>;
};

export default CharacterCatalogPanel;
