import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, PageHeader, SearchBar, StatePanel, TabBar, Toolbar } from '@tdn/shared';
import { useWorkspace } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { useResource } from './hooks';
import { ApiError } from './Feedback';
import { CatalogAttributeValuesEditor } from './CatalogAttributeValuesEditor';
import CatalogAttributesDialog from './CatalogAttributesDialog';
import CatalogDefinitionDialog from './CatalogDefinitionDialog';
import CatalogGroupsDialog from './CatalogGroupsDialog';
import CatalogGroupTree from './CatalogGroupTree';
import type { CatalogGroupEntriesEnvelope, CatalogKind, CatalogMetadata } from './catalogTypes';

export { CatalogAttributeValuesEditor };

type DefinitionDialogState = { entryId?: string; initialKind: CatalogKind };
type CatalogBrowseData = Pick<CatalogGroupEntriesEnvelope, 'entries' | 'diagnostics'>;

const entryDiagnosticLabels: Record<string, string> = {
  invalid_condition: 'Условие группы некорректно; автоматический отбор отключён.',
  unknown_attribute: 'Условие ссылается на отсутствующий атрибут.',
  incompatible_attribute_type: 'Условие использует устаревший тип атрибута.',
  invalid_attribute_value: 'Значение условия не соответствует схеме.',
};

const Catalog: React.FC<{ kind?: CatalogKind }> = ({ kind = 'Item' }) => {
  const { groupId = '' } = useParams();
  const campaignId = Number(groupId);
  const { api, path, sessionKey } = useWorkspace();
  const { permissions, permissionsLoading, mode, reloadPermissions } = useCampaignWorkspace();
  const identity = `${sessionKey}:${campaignId}`;
  const canManage = mode === 'gm' && !permissionsLoading && permissions.canWrite;
  const canKeepManagementDialogs = mode === 'gm' && (permissionsLoading || permissions.canWrite);

  const [search, setSearch] = useState('');
  const [groupIdSelected, setGroupIdSelected] = useState('');
  const [definitionDialog, setDefinitionDialog] = useState<DefinitionDialogState>();
  const [attributesOpen, setAttributesOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);

  const entries = useResource<CatalogBrowseData>(
    `${identity}:catalog-browse:${groupIdSelected || 'ungrouped'}`,
    () => groupIdSelected
      ? api.getCatalogGroupEntries(campaignId, groupIdSelected).then(({ entries: groupEntries, diagnostics }) => ({ entries: groupEntries, diagnostics }))
      : api.listCatalog(campaignId).then(catalogEntries => ({ entries: catalogEntries, diagnostics: [] })),
  );
  const summaries = useResource(`${identity}:catalog-groups`, () => api.getCatalogGroups(campaignId));
  const schema = useResource(`${identity}:catalog-attributes`, () => api.getCatalogAttributes(campaignId));

  React.useEffect(() => {
    if (!canKeepManagementDialogs) {
      setAttributesOpen(false);
      setGroupsOpen(false);
    }
  }, [canKeepManagementDialogs]);

  const filteredEntries = useMemo(() => (entries.data?.entries ?? []).filter(entry => {
    const kindMatches = entry.kind === kind;
    const nameMatches = entry.name.toLocaleLowerCase().includes(search.toLocaleLowerCase());
    return kindMatches && nameMatches;
  }), [entries.data, kind, search]);

  const openDefinition = (entry: CatalogMetadata) => setDefinitionDialog({ entryId: entry.id, initialKind: entry.kind });
  const startCreate = () => {
    if (!canManage) return;
    setDefinitionDialog({ initialKind: kind });
  };

  const acceptSavedMetadata = (saved: CatalogMetadata) => {
    if (groupIdSelected) {
      entries.reload();
      return;
    }
    const current = entries.data?.entries;
    if (!current) {
      entries.reload();
      return;
    }
    const index = current.findIndex(item => item.id === saved.id);
    const next = [...current];
    if (index >= 0) next[index] = saved;
    else next.push(saved);
    entries.setData({ entries: next, diagnostics: [] });
  };

  return <>
    <PageHeader title="Каталог" subtitle="Общие определения предметов и навыков кампании" />
    <TabBar
      aria-label="Разделы каталога"
      basePath={path(`/${campaignId}/${mode}/catalog`)}
      tabs={[
        { id: 'items', label: 'Предметы', path: '' },
        { id: 'skills', label: 'Навыки', path: 'skills' },
      ]}
    />
    <Toolbar><SearchBar searchTerm={search} onSearchChange={setSearch} compact aria-label="Поиск по названию" /></Toolbar>

    {summaries.loading && !summaries.data && <StatePanel kind="loading">Загрузка групп каталога…</StatePanel>}
    {summaries.error && <ApiError error={summaries.error} onRetry={summaries.reload} />}
    {summaries.data && <CatalogGroupTree
      groups={summaries.data.groups}
      selectedId={groupIdSelected}
      onSelect={setGroupIdSelected}
    />}
    {groupIdSelected && <Button variant="secondary" onClick={() => setGroupIdSelected('')}>Сбросить группу</Button>}

    {schema.error && <ApiError error={schema.error} onRetry={schema.reload} />}
    {canManage && <div>
      <Button onClick={startCreate}>Создать определение</Button>
      <Button variant="secondary" onClick={() => setAttributesOpen(true)}>Атрибуты каталога</Button>
      <Button variant="secondary" onClick={() => setGroupsOpen(true)}>Группы каталога</Button>
    </div>}

    {entries.loading && !entries.data && <StatePanel kind="loading">Загрузка каталога…</StatePanel>}
    {entries.error && <ApiError error={entries.error} onRetry={entries.reload} />}
    {entries.data && entries.data.diagnostics.map((diagnostic, index) => {
      const name = diagnostic.entryId
        ? entries.data?.entries.find(entry => entry.id === diagnostic.entryId)?.name
        : undefined;
      return <p role="status" key={`${diagnostic.groupId}-${diagnostic.entryId ?? 'group'}-${diagnostic.code}-${index}`}>
        {entryDiagnosticLabels[diagnostic.code] ?? 'Сервер обнаружил проблему при вычислении состава группы.'}
        {diagnostic.entryId ? ` Определение: ${name ?? 'недоступно'}.` : ''}
      </p>;
    })}
    {entries.data && filteredEntries.length === 0 && <StatePanel kind="empty">Ничего не найдено</StatePanel>}
    {entries.data && filteredEntries.length > 0 && <ul>{filteredEntries.map(entry => <li key={entry.id}>
      <Button variant="secondary" onClick={() => openDefinition(entry)}>
        {entry.name} <small>{entry.kind === 'Item' ? 'Предмет' : 'Навык'}</small>
      </Button>
    </li>)}</ul>}
    {!entries.data && !entries.loading && !entries.error && <StatePanel kind="error">Каталог недоступен.</StatePanel>}

    {definitionDialog && <CatalogDefinitionDialog
      key={`${identity}:${definitionDialog.entryId ?? `new-${definitionDialog.initialKind}`}`}
      campaignId={campaignId}
      entryId={definitionDialog.entryId}
      initialKind={definitionDialog.initialKind}
      canAdmin={canManage}
      permissionsPending={permissionsLoading}
      onClose={() => setDefinitionDialog(undefined)}
      onSaved={acceptSavedMetadata}
      onForbidden={reloadPermissions}
    />}

    {canKeepManagementDialogs && attributesOpen && <CatalogAttributesDialog
      key={`${identity}:attributes`}
      campaignId={campaignId}
      canManage={canManage}
      permissionsPending={permissionsLoading}
      onClose={() => setAttributesOpen(false)}
      onSaved={result => schema.setData(result)}
      onForbidden={reloadPermissions}
    />}
    {canKeepManagementDialogs && groupsOpen && <CatalogGroupsDialog
      key={`${identity}:groups`}
      campaignId={campaignId}
      canManage={canManage}
      permissionsPending={permissionsLoading}
      onClose={() => setGroupsOpen(false)}
      onSaved={result => {
        summaries.setData({
          campaignId: result.campaignId,
          contentRevision: result.contentRevision,
          groups: result.data.groups.map(({ id, title, parentId }) => ({ id, title, parentId })),
        });
        if (groupIdSelected) entries.reload();
      }}
      onForbidden={reloadPermissions}
    />}
  </>;
};

export default Catalog;
