import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ActionRow, Button, IconButton, PageHeader, SearchBar, StatePanel, TabBar, Toolbar } from '@tdn/shared';
import { useWorkspace } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { useResource } from './hooks';
import { ApiError } from './Feedback';
import { CampaignApiError } from './api';
import { CatalogAttributeValuesEditor } from './CatalogAttributeValuesEditor';
import CatalogAttributesDialog from './CatalogAttributesDialog';
import CatalogDefinitionDialog from './CatalogDefinitionDialog';
import CatalogGroupsDialog from './CatalogGroupsDialog';
import CatalogSections from './CatalogSections';
import { buildCatalogBrowseModel } from './catalogBrowseModel';
import type { CatalogMembershipResult } from './catalogBrowseModel';
import type { CatalogContentEnvelope, CatalogGroupConfigurationEnvelope, CatalogGroupSummary, CatalogKind, CatalogMetadata } from './catalogTypes';

export { CatalogAttributeValuesEditor };

type DefinitionDialogState = { entryId?: string; initialKind: CatalogKind };
type SearchExpansion = { scope: string; searching: boolean; previousKeys: Set<string> };
const emptyGroups: CatalogGroupSummary[] = [];

const Catalog: React.FC<{ kind?: CatalogKind }> = ({ kind = 'Item' }) => {
  const { groupId = '' } = useParams();
  const campaignId = Number(groupId);
  const { api, path, sessionKey } = useWorkspace();
  const { permissions, permissionsLoading, mode, reloadPermissions } = useCampaignWorkspace();
  const identity = `${sessionKey}:${campaignId}`;
  const browseScope = `${identity}:${kind}`;
  const canManage = mode === 'gm' && !permissionsLoading && permissions.canWrite;
  const canKeepManagementDialogs = mode === 'gm' && (permissionsLoading || permissions.canWrite);

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<{ scope: string; keys: Set<string> }>({ scope: browseScope, keys: new Set() });
  const searchExpansion = useRef<SearchExpansion>({ scope: browseScope, searching: false, previousKeys: new Set() });
  const [definitionDialog, setDefinitionDialog] = useState<DefinitionDialogState>();
  const [attributesOpen, setAttributesOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [previewVersions, setPreviewVersions] = useState<Record<string, number>>({});
  const previewPromises = useMemo(() => new Map<string, Promise<CatalogContentEnvelope>>(), [api, identity]);

  const rootCatalog = useResource<CatalogMetadata[]>(`${identity}:catalog-browse`, () => api.listCatalog(campaignId));
  const summaries = useResource(`${identity}:catalog-groups`, () => api.getCatalogGroups(campaignId));
  const schema = useResource(`${identity}:catalog-attributes`, () => api.getCatalogAttributes(campaignId));
  const loadPreview = useCallback((entryId: string) => {
    const existing = previewPromises.get(entryId);
    if (existing) return existing;
    const request = api.getCatalogContent(campaignId, entryId);
    previewPromises.set(entryId, request);
    request.catch(() => {
      if (previewPromises.get(entryId) === request) previewPromises.delete(entryId);
    });
    return request;
  }, [api, campaignId, previewPromises]);
  const summariesForbidden = summaries.error instanceof CampaignApiError
    && (summaries.error.status === 403 || summaries.error.status === 404);
  const groups = summariesForbidden ? emptyGroups : summaries.data?.groups ?? emptyGroups;
  const membershipScope = `${String(summaries.data?.contentRevision ?? '')}:${groups.map(group => group.id).join(',')}`;
  const memberships = useResource<CatalogMembershipResult[]>(
    `${identity}:catalog-memberships:${membershipScope}`,
    async () => Promise.all(groups.map(async group => {
      try {
        const result = await api.getCatalogGroupEntries(campaignId, group.id);
        return { groupId: group.id, entries: result.entries, diagnostics: result.diagnostics };
      } catch (error) {
        return { groupId: group.id, error };
      }
    })),
    Boolean(summaries.data) && !summariesForbidden,
  );

  useEffect(() => {
    if (!canKeepManagementDialogs) {
      setAttributesOpen(false);
      setGroupsOpen(false);
    }
  }, [canKeepManagementDialogs]);

  const rootCatalogForbidden = rootCatalog.error instanceof CampaignApiError
    && (rootCatalog.error.status === 403 || rootCatalog.error.status === 404);
  const model = useMemo(() => rootCatalog.data && !rootCatalogForbidden
    ? buildCatalogBrowseModel({
      rootCatalog: rootCatalog.data,
      groups,
      memberships: memberships.data ?? [],
      kind,
      search,
      summariesReady: Boolean(summaries.data) && !summaries.error,
      membershipsReady: Boolean(memberships.data) && !memberships.error && !summaries.error,
    })
    : undefined,
  [rootCatalog.data, rootCatalogForbidden, groups, memberships.data, memberships.error, kind, search, summaries.data, summaries.error]);

  const openKeys = expanded.scope === browseScope ? expanded.keys : new Set<string>();
  useEffect(() => {
    if (searchExpansion.current.scope !== browseScope) {
      searchExpansion.current = { scope: browseScope, searching: Boolean(search.trim()), previousKeys: new Set() };
    }
    if (search.trim() && model) {
      setExpanded(current => {
        const next = new Set(current.scope === browseScope ? current.keys : []);
        model.keysToOpenForSearch.forEach(key => next.add(key));
        return current.scope === browseScope && next.size === current.keys.size && [...next].every(key => current.keys.has(key))
          ? current
          : { scope: browseScope, keys: next };
      });
    }
  }, [browseScope, search, model?.keysToOpenForSearch]);

  const changeSearch = (value: string) => {
    const hasQuery = Boolean(value.trim());
    const current = searchExpansion.current.scope === browseScope
      ? searchExpansion.current
      : { scope: browseScope, searching: false, previousKeys: new Set<string>() };
    if (!hasQuery && current.searching) {
      setExpanded({ scope: browseScope, keys: new Set(current.previousKeys) });
      searchExpansion.current = { scope: browseScope, searching: false, previousKeys: new Set() };
    } else if (hasQuery && !current.searching) {
      searchExpansion.current = { scope: browseScope, searching: true, previousKeys: new Set(openKeys) };
    } else if (hasQuery) {
      searchExpansion.current = current;
    }
    setSearch(value);
  };

  const openDefinition = (entry: CatalogMetadata) => setDefinitionDialog({ entryId: entry.id, initialKind: entry.kind });
  const startCreate = () => {
    if (!canManage) return;
    setDefinitionDialog({ initialKind: kind });
  };

  const acceptSavedMetadata = (saved: CatalogMetadata, content?: CatalogContentEnvelope) => {
    if (content) previewPromises.set(saved.id, Promise.resolve(content));
    else previewPromises.delete(saved.id);
    setPreviewVersions(current => ({ ...current, [saved.id]: (current[saved.id] ?? 0) + 1 }));
    const current = rootCatalog.data;
    if (!current) {
      rootCatalog.reload();
    } else {
      const index = current.findIndex(item => item.id === saved.id);
      const next = [...current];
      if (index >= 0) next[index] = saved;
      else next.push(saved);
      rootCatalog.setData(next);
    }
    if (memberships.data) memberships.reload();
  };

  const allSectionsOpen = Boolean(model?.sectionKeys.length)
    && model!.sectionKeys.every(key => openKeys.has(key));
  const toggleAll = () => {
    if (!model) return;
    const keys = allSectionsOpen ? new Set<string>() : new Set(model.sectionKeys);
    setExpanded({ scope: browseScope, keys });
  };

  const rootEntriesUnavailable = rootCatalogForbidden ? undefined : rootCatalog.data;

  return <>
    <PageHeader title="Каталог" subtitle="Предметы и навыки кампании" />
    <TabBar
      aria-label="Разделы каталога"
      basePath={path(`/${campaignId}/${mode}/catalog`)}
      tabs={[
        { id: 'items', label: 'Предметы', path: 'items' },
        { id: 'skills', label: 'Навыки', path: 'skills' },
      ]}
    />
    <Toolbar>
      <SearchBar searchTerm={search} onSearchChange={changeSearch} compact aria-label="Поиск по названию" />
      <ActionRow style={{ gap: '0.5rem' }}>
        <IconButton
          icon={allSectionsOpen ? 'collapse-all' : 'expand-all'}
          size="small"
          variant="secondary"
          title={allSectionsOpen ? 'Свернуть всё' : 'Развернуть всё'}
          ariaLabel={allSectionsOpen ? 'Свернуть всё' : 'Развернуть всё'}
          disabled={!model?.sectionKeys.length}
          onClick={toggleAll}
        />
        {canManage && <>
          <IconButton icon="add" size="small" variant="secondary" title={kind === 'Item' ? 'Создать предмет' : 'Создать навык'} ariaLabel={kind === 'Item' ? 'Создать предмет' : 'Создать навык'} onClick={startCreate} />
          <IconButton icon="edit" size="small" variant="secondary" title="Атрибуты каталога" ariaLabel="Атрибуты каталога" onClick={() => setAttributesOpen(true)} />
          <IconButton icon="sort" size="small" variant="secondary" title="Группы каталога" ariaLabel="Группы каталога" onClick={() => setGroupsOpen(true)} />
        </>}
      </ActionRow>
    </Toolbar>

    {Boolean(rootCatalog.error) && <ApiError error={rootCatalog.error} onRetry={rootCatalog.reload} />}
    {Boolean(summaries.error) && <ApiError error={summaries.error} onRetry={summaries.reload} />}
    {Boolean(schema.error) && <ApiError error={schema.error} onRetry={schema.reload} />}
    {summaries.loading && !summaries.data && <StatePanel kind="loading">Загрузка групп каталога…</StatePanel>}
    {rootCatalog.loading && !rootEntriesUnavailable && <StatePanel kind="loading">Загрузка каталога…</StatePanel>}
    {!rootEntriesUnavailable && !rootCatalog.loading && !rootCatalog.error && <StatePanel kind="error">Каталог недоступен.</StatePanel>}

    {model && <>
      {model.ungroupedState === 'loading' && summaries.data && <StatePanel kind="loading">Проверка принадлежности записей к группам…</StatePanel>}
      {model.ungroupedState === 'unavailable' && (memberships.data?.some(result => result.error)
        ? <><StatePanel kind="error">Не удалось определить, какие записи не входят в группы.</StatePanel><Button size="small" variant="ghost" type="button" onClick={memberships.reload}>Повторить загрузку групп</Button></>
        : summaries.error
          ? null
          : <StatePanel kind="loading">Загрузка групп каталога…</StatePanel>)}
      {model.noMatches && !rootCatalog.error && <StatePanel kind="empty">Ничего не найдено</StatePanel>}
      <CatalogSections
        sections={model.sections}
        openKeys={openKeys}
        onToggle={(key, open) => setExpanded(current => {
          const keys = new Set(current.scope === browseScope ? current.keys : []);
          if (keys.has(key) === open) return current;
          if (open) keys.add(key);
          else keys.delete(key);
          return { scope: browseScope, keys };
        })}
        onOpenEntry={openDefinition}
        onRetryMembership={() => memberships.reload()}
        definitions={schema.data && !schema.error ? schema.data.data.definitions : undefined}
        attributeSchemaLoading={schema.loading && !schema.data && !schema.error}
        loadContent={loadPreview}
        previewScope={identity}
        previewVersions={previewVersions}
      />
    </>}

    {definitionDialog && <CatalogDefinitionDialog
      key={`${identity}:${definitionDialog.entryId ?? `new-${definitionDialog.initialKind}`}`}
      campaignId={campaignId}
      entryId={definitionDialog.entryId}
      initialKind={definitionDialog.initialKind}
      canAdmin={canManage}
      audience={mode}
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
      onSaved={(result: CatalogGroupConfigurationEnvelope) => summaries.setData({
        campaignId: result.campaignId,
        contentRevision: result.contentRevision,
        groups: result.data.groups.map(({ id, title, parentId }) => ({ id, title, parentId })),
      })}
      onForbidden={reloadPermissions}
    />}
  </>;
};

export default Catalog;
