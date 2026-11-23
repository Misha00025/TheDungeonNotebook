import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, DataTable, IconButton, List, ListItem, SearchBar, StatePanel, Toolbar } from '@tdn/shared';
import { ApiError } from './Feedback';
import { useCharacterCatalog } from './CharacterCatalogContext';
import type { CatalogGroupCondition, CatalogKind, CharacterCatalogEntryEnvelope } from './catalogTypes';
import CharacterCatalogAddDialog from './CharacterCatalogAddDialog';
import CharacterCatalogEntryDialog from './CharacterCatalogEntryDialog';
import { compileCatalogFilter } from './catalogFilter';

export type CharacterCatalogPanelProps = {
  kind: CatalogKind;
  canPublishDefinition?: boolean;
  readOnly?: boolean;
  characterName?: string;
  audience?: 'gm' | 'player';
  definitionPermissionsPending?: boolean;
  onDefinitionForbidden?: () => void;
  layout?: boolean;
  condition?: CatalogGroupCondition | null;
  preview?: boolean;
};

const CharacterCatalogPanel: React.FC<CharacterCatalogPanelProps> = ({ canPublishDefinition = false, readOnly = false, characterName, audience = 'player', definitionPermissionsPending = false, onDefinitionForbidden, layout = false, condition = null, preview = false }) => {
  const catalog = useCharacterCatalog();
  const kind = catalog.kind;
  const [search, setSearch] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ recordId: string; action: 'added' | 'changed' }>();
  const sectionRef = useRef<HTMLElement>(null);
  const selectedBaseline = useRef<{ id: string; revisions: string } | undefined>(undefined);
  const definitions = catalog.definitions ?? [];
  const compiledFilter = useMemo(() => compileCatalogFilter(condition, definitions), [condition, definitions]);
  const schemaReady = catalog.definitions !== undefined && !catalog.schemaError;
  const filterError = schemaReady ? compiledFilter.error : undefined;
  const sourceEntries = catalog.entries ?? [];
  const classified = useMemo(() => sourceEntries.map(entry => ({ entry, result: condition && schemaReady && !filterError ? compiledFilter.test(entry.effectiveAttributes) : condition ? undefined : true })), [sourceEntries, condition, schemaReady, filterError, compiledFilter]);
  const matched = condition && schemaReady && !filterError ? classified.filter(item => item.result === true).map(item => item.entry) : condition ? [] : sourceEntries;
  const incompatible = condition && schemaReady && !filterError ? classified.filter(item => item.result === undefined).map(item => item.entry) : [];
  const matchesSearch = (entry: CharacterCatalogEntryEnvelope) => entry.definition.name.toLocaleLowerCase().includes(search.toLocaleLowerCase());
  const entries = useMemo(() => matched.filter(entry => entry.definition.kind === kind && matchesSearch(entry))
    .sort((left, right) => left.definition.name.localeCompare(right.definition.name)), [matched, kind, search]);
  const incompatibleEntries = incompatible.filter(matchesSearch).sort((left, right) => left.definition.name.localeCompare(right.definition.name));
  const canAdd = catalog.canWrite && !readOnly && !preview;

  useEffect(() => {
    if (!selectedEntryId || !catalog.entries) return;
    const selected = catalog.entries.find(entry => entry.record.id === selectedEntryId);
    if (!selected) { setNotice(current => current?.recordId === selectedEntryId ? undefined : current); return; }
    const revisions = `${String(selected.record.metadataRevision)}:${String(selected.localContentRevision)}:${String(selected.definitionContentRevision)}`;
    const baseline = selectedBaseline.current;
    if (baseline?.id === selectedEntryId && baseline.revisions !== revisions) setNotice({ recordId: selectedEntryId, action: 'changed' });
    selectedBaseline.current = { id: selectedEntryId, revisions };
  }, [catalog.entries, selectedEntryId]);

  const filterState = new Map(classified.map(item => [item.entry.record.id, item.result]));
  const noticeEntry = notice && catalog.entries?.find(entry => entry.record.id === notice.recordId);
  const noticeResult = noticeEntry ? filterState.get(noticeEntry.record.id) : undefined;
  const noticeReason = !filterError && noticeEntry && noticeResult === false ? 'filter' : !filterError && noticeEntry && noticeResult === true && !matchesSearch(noticeEntry) ? 'search' : undefined;
  useEffect(() => {
    if (notice && (!catalog.entries || !noticeEntry)) { setNotice(undefined); return; }
    if (!notice || !noticeEntry) return;
    if (noticeResult === true && matchesSearch(noticeEntry)) setNotice(undefined);
  }, [notice, noticeEntry, noticeResult, search, catalog.entries]);

  const openEntry = (entry: CharacterCatalogEntryEnvelope) => {
    selectedBaseline.current = { id: entry.record.id, revisions: `${String(entry.record.metadataRevision)}:${String(entry.localContentRevision)}:${String(entry.definitionContentRevision)}` };
    setSelectedEntryId(entry.record.id);
  };
  const closeEntry = () => {
    const triggerVisible = selectedEntryId ? entries.some(entry => entry.record.id === selectedEntryId) : true;
    setSelectedEntryId(undefined);
    if (!triggerVisible) sectionRef.current?.focus();
  };

  if (layout) return <section ref={sectionRef} tabIndex={-1} aria-busy={catalog.loading}>
    <Toolbar><SearchBar searchTerm={search} onSearchChange={setSearch} compact aria-label="Поиск по названию" />{canAdd && <IconButton icon="add" title={kind === 'Item' ? 'Добавить предмет' : 'Добавить навык'} ariaLabel={kind === 'Item' ? 'Добавить предмет' : 'Добавить навык'} size="small" variant="secondary" onClick={() => setAdding(true)} />}</Toolbar>
    {!catalog.canRead && !catalog.permissionsPending && <StatePanel kind="error">Доступ к записям этого персонажа не подтверждён.</StatePanel>}
    {catalog.canRead && catalog.loading && !catalog.entries && <StatePanel kind="loading">Загрузка записей персонажа…</StatePanel>}
    {catalog.canRead && condition && catalog.schemaLoading && !catalog.definitions && <StatePanel kind="loading">Загрузка схемы характеристик…</StatePanel>}
    {Boolean(catalog.entriesError) && <ApiError error={catalog.entriesError} onRetry={catalog.reload} />}
    {Boolean(catalog.schemaError) && <ApiError error={catalog.schemaError} onRetry={catalog.reload} />}
    {filterError && <p role="status">Невозможно применить фильтр раздела: его настройки требуют обновления.</p>}
    {catalog.entries && !filterError && (!condition || schemaReady) && entries.length > 0 && <List layout="vertical" stretch gap="small">{entries.map(entry => <ListItem key={entry.record.id} density="compact" meta={kind === 'Item' ? entry.record.quantity === null ? '—' : String(entry.record.quantity) : undefined}><Button type="button" size="small" variant="ghost" onClick={() => openEntry(entry)}>{entry.definition.name}</Button></ListItem>)}</List>}
    {catalog.entries && !catalog.entriesLoading && !catalog.entriesError && sourceEntries.length === 0 && <StatePanel kind="empty">У персонажа пока нет {kind === 'Item' ? 'предметов' : 'навыков'}.</StatePanel>}
    {catalog.entries && !catalog.entriesLoading && !catalog.entriesError && !filterError && (!condition || schemaReady) && sourceEntries.length > 0 && entries.length === 0 && incompatibleEntries.length === 0 && search && <StatePanel kind="empty" actions={<Button type="button" size="small" variant="secondary" onClick={() => setSearch('')}>Очистить поиск</Button>}>Ничего не найдено</StatePanel>}
    {catalog.entries && !catalog.entriesLoading && !catalog.entriesError && !filterError && (!condition || schemaReady) && sourceEntries.length > 0 && entries.length === 0 && incompatibleEntries.length === 0 && !search && condition && <StatePanel kind="empty">Нет записей, соответствующих этому разделу</StatePanel>}
    {incompatibleEntries.length > 0 && <details><summary>Записи с несовместимыми характеристиками ({incompatibleEntries.length})</summary><List layout="vertical" stretch gap="small">{incompatibleEntries.map(entry => <ListItem key={entry.record.id} density="compact" meta={kind === 'Item' ? entry.record.quantity === null ? '—' : String(entry.record.quantity) : undefined}><Button type="button" size="small" variant="ghost" onClick={() => openEntry(entry)}>{entry.definition.name}</Button></ListItem>)}</List></details>}
    {notice && noticeEntry && noticeReason && <div role="status">
      <p>{kind === 'Item' ? 'Предмет' : 'Навык'} {notice.action === 'added' ? 'добавлен' : 'изменён'}, но {noticeReason === 'filter' ? 'не соответствует фильтру раздела.' : 'скрыт текущим поиском.'}</p>
      <ActionRow style={{ '--al-gap': '0.5rem' } as React.CSSProperties}>
        <Button type="button" size="small" variant="secondary" onClick={() => { if (noticeReason === 'search') setSearch(''); openEntry(noticeEntry); }}>Открыть запись</Button>
        <IconButton icon="close" title="Закрыть уведомление" ariaLabel="Закрыть уведомление" size="small" variant="secondary" onClick={() => setNotice(undefined)} />
      </ActionRow>
    </div>}
    {selectedEntryId && <CharacterCatalogEntryDialog key={kind} entryId={selectedEntryId} readOnly={preview || readOnly || !catalog.canWrite} preview={preview} characterName={characterName} audience={audience} canAdminDefinition={canPublishDefinition} definitionPermissionsPending={definitionPermissionsPending} onDefinitionForbidden={onDefinitionForbidden} onClose={closeEntry} />}
    {adding && <CharacterCatalogAddDialog kind={kind} canPublishDefinition={canPublishDefinition} characterName={characterName} definitionPermissionsPending={definitionPermissionsPending} onAdded={entry => setNotice({ recordId: entry.record.id, action: 'added' })} onClose={() => setAdding(false)} />}
  </section>;

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
