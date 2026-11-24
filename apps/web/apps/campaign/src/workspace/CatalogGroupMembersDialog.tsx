import React, { useId, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, Checkbox, DataTable, DataTableCell, ModalPortal, SearchBar, StatePanel, Toolbar } from '@tdn/shared';
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
    <DataTable aria-label={`Состав группы ${groupLabel}`}>
      <thead><tr><DataTableCell as="th" scope="col" sizing="control">В группе</DataTableCell><DataTableCell as="th" scope="col">Предмет или навык</DataTableCell><DataTableCell as="th" scope="col" sizing="content">Тип</DataTableCell></tr></thead>
      <tbody>
        {visibleEntries.map(entry => <tr key={entry.id}>
          <DataTableCell sizing="control"><Checkbox aria-label={`Включить ${entry.name} в группу`} checked={selectedIds.has(entry.id)} disabled={disabled} onChange={event => toggle(entry.id, event.target.checked)} /></DataTableCell>
          <DataTableCell as="th" scope="row">{entry.name}{entry.isHidden && <small> · скрытое</small>}</DataTableCell>
          <DataTableCell sizing="content">{entry.kind === 'Item' ? 'Предмет' : 'Навык'}</DataTableCell>
        </tr>)}
        {unavailableIds.map((entryId, index) => <tr key={`unavailable-${entryId}`}>
          <DataTableCell sizing="control"><Checkbox aria-label={`Убрать недоступную запись ${index + 1} из группы`} checked disabled={disabled} onChange={event => toggle(entryId, event.target.checked)} /></DataTableCell>
          <DataTableCell as="th" scope="row">Недоступная запись</DataTableCell>
          <DataTableCell sizing="content">Недоступно</DataTableCell>
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
