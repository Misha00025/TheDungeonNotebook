import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, IconButton, SearchBar, StatePanel, Toolbar } from '@tdn/shared';
import { ApiError } from './Feedback';
import { useCharacterCatalog } from './CharacterCatalogContext';
import type { CatalogGroupCondition, CatalogKind, CharacterCatalogEntryEnvelope } from './catalogTypes';
import CharacterCatalogAddDialog from './CharacterCatalogAddDialog';
import CharacterCatalogEntryDialog from './CharacterCatalogEntryDialog';
import { compileCatalogFilter } from './catalogFilter';
import { CatalogEntryTable, CatalogEntryTableRow } from './CatalogEntryTable';
import CharacterCatalogQuantity from './CharacterCatalogQuantity';

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
  attributeIds?: string[] | null;
};

const CharacterCatalogPanel: React.FC<CharacterCatalogPanelProps> = ({ canPublishDefinition = false, readOnly = false, characterName, audience = 'player', definitionPermissionsPending = false, onDefinitionForbidden, layout = false, condition = null, preview = false, attributeIds }) => {
  const catalog = useCharacterCatalog();
  const kind = catalog.kind;
  const [search, setSearch] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ recordId: string; action: 'added' | 'changed' }>();
  const [activeQuantityIds, setActiveQuantityIds] = useState<Set<string>>(() => new Set());
  const sectionRef = useRef<HTMLElement>(null);
  const selectedBaseline = useRef<{ id: string; revisions: string } | undefined>(undefined);
  const definitions = catalog.definitions ?? [];
  const selectedAttributeIds = attributeIds ?? [];
  const layoutAttributeDefinitions = definitions.filter(definition => selectedAttributeIds.includes(definition.id));
  const compiledFilter = useMemo(() => compileCatalogFilter(condition, definitions), [condition, definitions]);
  const schemaReady = catalog.definitions !== undefined && !catalog.schemaError;
  const filterApplied = Boolean(condition && schemaReady && !compiledFilter.error);
  const filterNotApplied = Boolean(condition && !filterApplied);
  const sourceEntries = catalog.entries ?? [];
  const classified = useMemo(() => sourceEntries.map(entry => ({ entry, result: filterApplied ? compiledFilter.test(entry.effectiveAttributes) : condition ? undefined : true })), [sourceEntries, condition, filterApplied, compiledFilter]);
  const filterState = new Map(classified.map(item => [item.entry.record.id, item.result]));
  const matched = filterApplied ? classified.filter(item => item.result === true).map(item => item.entry) : sourceEntries;
  const incompatible = filterApplied ? classified.filter(item => item.result === undefined).map(item => item.entry) : [];
  const matchesSearch = (entry: CharacterCatalogEntryEnvelope) => entry.definition.name.toLocaleLowerCase().includes(search.toLocaleLowerCase());
  const entries = useMemo(() => matched.filter(entry => entry.definition.kind === kind && matchesSearch(entry))
    .sort((left, right) => left.definition.name.localeCompare(right.definition.name)), [matched, kind, search]);
  const incompatibleEntries = incompatible.filter(matchesSearch).sort((left, right) => left.definition.name.localeCompare(right.definition.name));
  const activeQuantityEntries = sourceEntries.filter(entry => activeQuantityIds.has(entry.record.id) && entry.definition.kind === kind);
  const activeIncompatibleEntries = layout && filterApplied
    ? activeQuantityEntries.filter(entry => filterState.has(entry.record.id) && filterState.get(entry.record.id) === undefined)
    : [];
  const mainActiveEntries = activeQuantityEntries.filter(entry => !activeIncompatibleEntries.some(item => item.record.id === entry.record.id));
  const mainEntries = [...new Map([...entries, ...mainActiveEntries].map(entry => [entry.record.id, entry])).values()]
    .sort((left, right) => left.definition.name.localeCompare(right.definition.name));
  const visibleIncompatibleEntries = [...new Map([...incompatibleEntries, ...activeIncompatibleEntries]
    .map(entry => [entry.record.id, entry])).values()]
    .sort((left, right) => left.definition.name.localeCompare(right.definition.name));
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

  const noticeEntry = notice && catalog.entries?.find(entry => entry.record.id === notice.recordId);
  const noticeResult = noticeEntry ? filterState.get(noticeEntry.record.id) : undefined;
  const noticeReason = filterApplied && noticeEntry && noticeResult === false
    ? 'filter'
    : noticeEntry && !matchesSearch(noticeEntry) && (!filterApplied || noticeResult === true) ? 'search' : undefined;
  useEffect(() => {
    if (notice && (!catalog.entries || !noticeEntry)) { setNotice(undefined); return; }
    if (!notice || !noticeEntry) return;
    if ((!filterApplied || noticeResult === true) && matchesSearch(noticeEntry)) setNotice(undefined);
  }, [notice, noticeEntry, noticeResult, search, catalog.entries, filterApplied]);

  const onQuantityStateChange = useCallback((id: string, active: boolean) => {
    setActiveQuantityIds(current => {
      if (current.has(id) === active) return current;
      const next = new Set(current);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const onQuantitySaved = useCallback((updated: CharacterCatalogEntryEnvelope) => {
    setNotice({ recordId: updated.record.id, action: 'changed' });
  }, []);
  const quantityFor = (entry: CharacterCatalogEntryEnvelope) => kind === 'Item'
    ? <CharacterCatalogQuantity entry={entry} readOnly={readOnly} preview={preview} onStateChange={onQuantityStateChange} onSaved={onQuantitySaved} />
    : undefined;
  const openEntry = (entry: CharacterCatalogEntryEnvelope) => {
    if (activeQuantityIds.has(entry.record.id)) return;
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
    {filterNotApplied && <p role="status">Фильтр раздела не применён. Показаны все доступные записи.</p>}
    {catalog.entries && mainEntries.length > 0 &&
      <CatalogEntryTable label={kind === 'Item' ? 'Инвентарь персонажа' : 'Навыки персонажа'} attributeDefinitions={layoutAttributeDefinitions} showQuantity={kind === 'Item'}>
         {mainEntries.map(entry => <CatalogEntryTableRow key={entry.record.id} name={entry.definition.name} onOpen={() => openEntry(entry)} openDisabled={activeQuantityIds.has(entry.record.id)} note={activeQuantityIds.has(entry.record.id) && !entries.some(item => item.record.id === entry.record.id) ? 'Вне текущего отбора' : undefined} definitions={catalog.definitions} values={entry.effectiveAttributes} attributesLoading={catalog.schemaLoading} attributesError={catalog.schemaError} onRetryAttributes={catalog.reload} quantity={quantityFor(entry)} attributeIds={selectedAttributeIds} />)}
      </CatalogEntryTable>}
    {catalog.entries && !catalog.entriesLoading && !catalog.entriesError && sourceEntries.length === 0 && <StatePanel kind="empty">У персонажа пока нет {kind === 'Item' ? 'предметов' : 'навыков'}.</StatePanel>}
    {catalog.entries && !catalog.entriesLoading && !catalog.entriesError && sourceEntries.length > 0 && mainEntries.length === 0 && incompatibleEntries.length === 0 && search && <StatePanel kind="empty" actions={<Button type="button" size="small" variant="secondary" onClick={() => setSearch('')}>Очистить поиск</Button>}>Ничего не найдено</StatePanel>}
    {catalog.entries && !catalog.entriesLoading && !catalog.entriesError && filterApplied && sourceEntries.length > 0 && mainEntries.length === 0 && incompatibleEntries.length === 0 && !search && <StatePanel kind="empty">Нет записей, соответствующих этому разделу</StatePanel>}
    {visibleIncompatibleEntries.length > 0 && <details><summary>Записи с несовместимыми характеристиками ({visibleIncompatibleEntries.length})</summary>
      <CatalogEntryTable label="Записи с несовместимыми характеристиками" attributeDefinitions={layoutAttributeDefinitions} showQuantity={kind === 'Item'}>
         {visibleIncompatibleEntries.map(entry => <CatalogEntryTableRow key={entry.record.id} name={entry.definition.name} onOpen={() => openEntry(entry)} openDisabled={activeQuantityIds.has(entry.record.id)} note={activeQuantityIds.has(entry.record.id) && !entries.some(item => item.record.id === entry.record.id) ? 'Вне текущего отбора' : undefined} definitions={catalog.definitions} values={entry.effectiveAttributes} attributesLoading={catalog.schemaLoading} attributesError={catalog.schemaError} onRetryAttributes={catalog.reload} quantity={quantityFor(entry)} attributeIds={selectedAttributeIds} />)}
      </CatalogEntryTable></details>}
    {notice && noticeEntry && noticeReason && <div role="status">
      <p>{kind === 'Item' ? 'Предмет' : 'Навык'} {notice.action === 'added' ? 'добавлен' : 'изменён'}, но {noticeReason === 'filter' ? 'не соответствует фильтру раздела.' : 'скрыт текущим поиском.'}</p>
      <ActionRow style={{ '--al-gap': '0.5rem' } as React.CSSProperties}>
        <Button type="button" size="small" variant="secondary" onClick={() => { if (noticeReason === 'search') setSearch(''); openEntry(noticeEntry); }}>Открыть запись</Button>
        <IconButton icon="close" title="Закрыть уведомление" ariaLabel="Закрыть уведомление" size="small" variant="secondary" onClick={() => setNotice(undefined)} />
      </ActionRow>
    </div>}
    {selectedEntryId && <CharacterCatalogEntryDialog key={kind} entryId={selectedEntryId} readOnly={preview || readOnly || !catalog.canWrite} preview={preview} characterName={characterName} audience={audience} canAdminDefinition={canPublishDefinition} definitionPermissionsPending={definitionPermissionsPending} onDefinitionForbidden={onDefinitionForbidden} onClose={closeEntry} />}
    {adding && <CharacterCatalogAddDialog kind={kind} canPublishDefinition={canPublishDefinition} characterName={characterName} definitionPermissionsPending={definitionPermissionsPending} audience={audience} onDefinitionForbidden={onDefinitionForbidden} onAdded={entry => setNotice({ recordId: entry.record.id, action: 'added' })} onClose={() => setAdding(false)} />}
  </section>;

  return <section aria-busy={catalog.loading}>
    <Toolbar><SearchBar searchTerm={search} onSearchChange={setSearch} compact aria-label="Поиск по названию" /></Toolbar>
    {canAdd && <Button type="button" onClick={() => setAdding(true)}>{kind === 'Item' ? 'Добавить предмет' : 'Добавить навык'}</Button>}
    {!catalog.canRead && !catalog.permissionsPending && <StatePanel kind="error">Доступ к записям этого персонажа не подтверждён.</StatePanel>}
    {catalog.canRead && catalog.loading && !catalog.entries && <StatePanel kind="loading">Загрузка записей персонажа…</StatePanel>}
    {catalog.canRead && condition && catalog.schemaLoading && !catalog.definitions && <StatePanel kind="loading">Загрузка схемы характеристик…</StatePanel>}
    {Boolean(catalog.entriesError) && <ApiError error={catalog.entriesError} onRetry={catalog.reload} />}
    {Boolean(catalog.schemaError) && <ApiError error={catalog.schemaError} onRetry={catalog.reload} />}
    {filterNotApplied && <p role="status">Фильтр раздела не применён. Показаны все доступные записи.</p>}
    {catalog.entries && !catalog.entriesLoading && !catalog.entriesError && mainEntries.length === 0 && <StatePanel kind="empty">Ничего не найдено</StatePanel>}
    {catalog.entries && mainEntries.length > 0 && <CatalogEntryTable label={kind === 'Item' ? 'Инвентарь персонажа' : 'Навыки персонажа'} showQuantity={kind === 'Item'}>
      {mainEntries.map(entry => <CatalogEntryTableRow key={entry.record.id} name={entry.definition.name} onOpen={() => { if (!activeQuantityIds.has(entry.record.id)) setSelectedEntryId(entry.record.id); }} openDisabled={activeQuantityIds.has(entry.record.id)} note={activeQuantityIds.has(entry.record.id) && !entries.some(item => item.record.id === entry.record.id) ? 'Вне текущего отбора' : undefined} definitions={catalog.definitions} values={entry.effectiveAttributes} attributesLoading={catalog.schemaLoading} attributesError={catalog.schemaError} onRetryAttributes={catalog.reload} quantity={quantityFor(entry)} />)}
    </CatalogEntryTable>}
    {selectedEntryId && <CharacterCatalogEntryDialog entryId={selectedEntryId} readOnly={readOnly || !catalog.canWrite} characterName={characterName} audience={audience} canAdminDefinition={canPublishDefinition} definitionPermissionsPending={definitionPermissionsPending} onDefinitionForbidden={onDefinitionForbidden} onClose={() => setSelectedEntryId(undefined)} />}
    {adding && <CharacterCatalogAddDialog kind={kind} canPublishDefinition={canPublishDefinition} characterName={characterName} definitionPermissionsPending={definitionPermissionsPending} audience={audience} onDefinitionForbidden={onDefinitionForbidden} onClose={() => setAdding(false)} />}
  </section>;
};

export default CharacterCatalogPanel;
