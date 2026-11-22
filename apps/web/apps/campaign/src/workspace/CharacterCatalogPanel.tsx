import React, { useMemo, useState } from 'react';
import { Button, DataTable, Field, Input, StatePanel } from '@tdn/shared';
import { ApiError } from './Feedback';
import { useCharacterCatalog } from './CharacterCatalogContext';
import type { CatalogKind } from './catalogTypes';
import CharacterCatalogAddDialog from './CharacterCatalogAddDialog';
import CharacterCatalogEntryDialog from './CharacterCatalogEntryDialog';

export type CharacterCatalogPanelProps = {
  kind: CatalogKind;
  canPublishDefinition?: boolean;
  readOnly?: boolean;
};

const CharacterCatalogPanel: React.FC<CharacterCatalogPanelProps> = ({ kind, canPublishDefinition = false, readOnly = false }) => {
  const catalog = useCharacterCatalog();
  const [search, setSearch] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string>();
  const [adding, setAdding] = useState(false);
  const entries = useMemo(() => (catalog.entries ?? [])
    .filter(entry => entry.definition.kind === kind && entry.definition.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((left, right) => left.definition.name.localeCompare(right.definition.name)), [catalog.entries, kind, search]);
  const canAdd = catalog.canWrite && !readOnly;

  return <section aria-busy={catalog.loading}>
    <Field label="Поиск по названию" htmlFor={`character-catalog-search-${kind.toLowerCase()}`}>
      <Input id={`character-catalog-search-${kind.toLowerCase()}`} value={search} onChange={event => setSearch(event.target.value)} />
    </Field>
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
    {selectedEntryId && <CharacterCatalogEntryDialog entryId={selectedEntryId} readOnly={readOnly || !catalog.canWrite} onClose={() => setSelectedEntryId(undefined)} />}
    {adding && <CharacterCatalogAddDialog kind={kind} canPublishDefinition={canPublishDefinition} onClose={() => setAdding(false)} />}
  </section>;
};

export default CharacterCatalogPanel;
