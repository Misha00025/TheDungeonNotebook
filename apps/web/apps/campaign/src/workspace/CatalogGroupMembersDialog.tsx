import React, { useId, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, Checkbox, DataTable, ModalPortal, SearchBar, StatePanel, Toolbar } from '@tdn/shared';
import { useDirtyDraft } from './Workspace';
import type { CatalogMetadata } from './catalogTypes';
import { stringifyJson } from './json';

type Props = {
  groupLabel: string;
  initialEntryIds: string[];
  catalogEntries: CatalogMetadata[];
  disabled: boolean;
  onApply: (entryIds: string[]) => void;
  onClose: () => void;
};

const CatalogGroupMembersDialog: React.FC<Props> = ({ groupLabel, initialEntryIds, catalogEntries, disabled, onApply, onClose }) => {
  const id = useId();
  const initialIds = useRef([...new Set(initialEntryIds)]);
  const [selectedIds, setSelectedIds] = useState(() => new Set(initialEntryIds));
  const [search, setSearch] = useState('');
  const selected = [...selectedIds];
  const dirty = stringifyJson(selected) !== stringifyJson(initialIds.current);
  useDirtyDraft(`catalog-group-members-${id}`, dirty);

  const entryById = useMemo(() => new Map(catalogEntries.map(entry => [entry.id, entry])), [catalogEntries]);
  const visibleEntries = useMemo(() => catalogEntries.filter(entry => entry.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [catalogEntries, search]);
  const unavailableIds = selected.filter(entryId => !entryById.has(entryId));
  const toggle = (entryId: string, checked: boolean) => setSelectedIds(current => {
    const next = new Set(current);
    if (checked) next.add(entryId);
    else next.delete(entryId);
    return next;
  });
  const apply = () => {
    if (disabled) return;
    onApply(selected);
  };

  return <ModalPortal isOpen onClose={onClose} title={`Состав: ${groupLabel}`} size="wide">
    <Toolbar><SearchBar searchTerm={search} onSearchChange={setSearch} compact aria-label="Поиск предметов и навыков" /></Toolbar>
    <DataTable aria-label={`Состав группы ${groupLabel}`} minWidth="32rem">
      <thead><tr><th scope="col">В группе</th><th scope="col">Предмет или навык</th><th scope="col">Тип</th></tr></thead>
      <tbody>
        {visibleEntries.map(entry => <tr key={entry.id}>
          <td><Checkbox aria-label={`Включить ${entry.name} в группу`} checked={selectedIds.has(entry.id)} disabled={disabled} onChange={event => toggle(entry.id, event.target.checked)} /></td>
          <th scope="row">{entry.name}{entry.isHidden && <small> · скрытое</small>}</th>
          <td>{entry.kind === 'Item' ? 'Предмет' : 'Навык'}</td>
        </tr>)}
        {unavailableIds.map((entryId, index) => <tr key={`unavailable-${entryId}`}>
          <td><Checkbox aria-label={`Убрать недоступную запись ${index + 1} из группы`} checked disabled={disabled} onChange={event => toggle(entryId, event.target.checked)} /></td>
          <th scope="row">Недоступная запись</th>
          <td>Недоступно</td>
        </tr>)}
      </tbody>
    </DataTable>
    {visibleEntries.length === 0 && <StatePanel kind="empty">Ничего не найдено</StatePanel>}
    <ActionRow style={{ gap: '0.5rem' }}>
      <Button type="button" disabled={disabled} onClick={apply}>Применить</Button>
      <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
    </ActionRow>
  </ModalPortal>;
};

export default CatalogGroupMembersDialog;
