import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Catalog from './Catalog';
import CatalogDefinitionDialog from './CatalogDefinitionDialog';
import CatalogGroupsDialog from './CatalogGroupsDialog';
import { CampaignApiError } from './api';
import { stringifyJson } from './json';
import type { CatalogContentEnvelope, CatalogCreateRequest, CatalogGroup, CatalogGroupConfigurationEnvelope, CatalogGroupInput, CatalogMetadata } from './catalogTypes';
import { buildCatalogBrowseModel } from './catalogBrowseModel';

type GroupPutBody = { expectedRevision: CatalogGroupConfigurationEnvelope['contentRevision']; groups: CatalogGroupInput[] };

const state = vi.hoisted(() => ({
  sessionKey: 'user-4',
  userId: 4,
  mode: 'player' as 'gm' | 'player',
  permissionsLoading: false,
  permissions: { canRead: true, canWrite: false, canManageAccess: false },
  api: {
    listCatalog: vi.fn(),
    getCatalogGroups: vi.fn(),
    getCatalogAttributes: vi.fn(),
    getCatalogGroupEntries: vi.fn(),
    getCatalogEntry: vi.fn(),
    getCatalogContent: vi.fn(),
    createCatalogEntry: vi.fn(),
    putCatalogMetadata: vi.fn(),
    putCatalogContent: vi.fn(),
    putCatalogAttributes: vi.fn(),
    getCatalogGroupConfiguration: vi.fn(),
    putCatalogGroups: vi.fn(),
  },
}));

vi.mock('./Workspace', () => ({
  useWorkspace: () => ({ api: state.api, sessionKey: state.sessionKey, path: (relative = '') => `/groups${relative}` }),
  useDirtyDraft: () => vi.fn(),
}));

vi.mock('./Shell', () => ({
  useCampaignWorkspace: () => ({
    campaign: { id: 12, name: 'Campaign 12' },
    permissions: state.permissions,
    lastKnownPermissions: state.permissions,
    permissionsLoading: state.permissionsLoading,
    mode: state.mode,
    reloadPermissions: vi.fn(),
  }),
}));

const responseAuth = (userId = state.userId) => ({
  status: 'authenticated',
  authenticated: true,
  userId,
  error: null,
  config: { BFF_BASE: '/bff', API_BASE: '/bff/api' },
  request: vi.fn(async () => new Response('{}')),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
}) as unknown as HubRemoteProps['auth'];

const renderCatalog = (path = '/groups/12/player/catalog/items') => render(
  <RemoteAuthProvider auth={responseAuth()}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/groups/:groupId/player/catalog/items" element={<Catalog kind="Item" />} />
        <Route path="/groups/:groupId/player/catalog/skills" element={<Catalog kind="Skill" />} />
        <Route path="/groups/:groupId/gm/catalog/items" element={<Catalog kind="Item" />} />
        <Route path="/groups/:groupId/gm/catalog/skills" element={<Catalog kind="Skill" />} />
      </Routes>
    </MemoryRouter>
  </RemoteAuthProvider>,
);

const metadata: CatalogMetadata = {
  id: 'entry-public',
  campaignId: 12,
  name: 'Public tonic',
  kind: 'Item',
  creatorUserId: 23,
  isHidden: false,
  quantityUnit: 'Whole',
  allowNegative: false,
  metadataRevision: 1,
};

const skillMetadata: CatalogMetadata = {
  id: 'entry-skill',
  campaignId: 12,
  name: 'Arcana',
  kind: 'Skill',
  creatorUserId: null,
  isHidden: false,
  quantityUnit: null,
  allowNegative: false,
  metadataRevision: 1,
};

const content: CatalogContentEnvelope = {
  campaignId: 12,
  resourceId: metadata.id,
  contentRevision: 1,
  data: { description: 'Restores a little health.', attributes: [] },
};

function resetApi() {
  Object.values(state.api).forEach(method => method.mockReset());
  state.sessionKey = 'user-4';
  state.userId = 4;
  state.mode = 'player';
  state.permissionsLoading = false;
  state.permissions = { canRead: true, canWrite: false, canManageAccess: false };
  state.api.listCatalog.mockImplementation(async (_campaignId: number, kind: CatalogMetadata['kind']) => kind === 'Item' ? [metadata] : [skillMetadata]);
  state.api.getCatalogGroups.mockResolvedValue({ campaignId: 12, contentRevision: 0, groups: [] });
  state.api.getCatalogAttributes.mockResolvedValue({ campaignId: 12, contentRevision: 0, data: { definitions: [] } });
  state.api.getCatalogGroupEntries.mockResolvedValue({ entries: [], diagnostics: [] });
  state.api.getCatalogEntry.mockResolvedValue(metadata);
  state.api.getCatalogContent.mockResolvedValue(content);
  state.api.createCatalogEntry.mockResolvedValue({ entry: metadata, content });
  state.api.putCatalogMetadata.mockResolvedValue({ ...metadata, metadataRevision: 2 });
  state.api.putCatalogContent.mockResolvedValue({ ...content, contentRevision: 2 });
  state.api.putCatalogAttributes.mockResolvedValue({ campaignId: 12, contentRevision: 1, data: { definitions: [] } });
  state.api.getCatalogGroupConfiguration.mockResolvedValue({ campaignId: 12, contentRevision: 0, data: { groups: [] }, diagnostics: [] });
  state.api.putCatalogGroups.mockResolvedValue({ campaignId: 12, contentRevision: 1, data: { groups: [] }, diagnostics: [] });
}

const renderDefinition = (props: Partial<React.ComponentProps<typeof CatalogDefinitionDialog>> = {}) => render(
  <RemoteAuthProvider auth={responseAuth()}>
    <MemoryRouter>
      <CatalogDefinitionDialog
        campaignId={12}
        initialKind="Item"
        canAdmin={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onForbidden={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  </RemoteAuthProvider>,
);

const renderGroupsDialog = (kind: CatalogMetadata['kind'] = 'Item') => render(
  <MemoryRouter>
    <CatalogGroupsDialog
      campaignId={12}
      kind={kind}
      canManage
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onForbidden={vi.fn()}
    />
  </MemoryRouter>,
);

function changeFocusedGroupTitle(value: string) {
  const input = screen.getAllByRole('textbox', { name: 'Название группы' }).find(element => element === document.activeElement);
  if (!input) throw new Error('A newly added group title input is not focused.');
  fireEvent.change(input, { target: { value } });
}

describe('campaign catalog', () => {
  beforeEach(resetApi);

  it('lets a player browse server-visible metadata without admin configuration access and opens another creator’s entry read-only', async () => {
    const definitions = [
      { id: 'charge', title: 'Заряды', typeKey: 'integer' as const, options: [] },
      { id: 'bound', title: 'Связан', typeKey: 'boolean' as const, options: [] },
    ];
    state.api.getCatalogAttributes.mockResolvedValue({ campaignId: 12, contentRevision: 1, data: { definitions } });
    state.api.getCatalogContent.mockResolvedValue({ ...content, data: { description: content.data.description, attributes: [
      { id: 'charge-value', attributeId: 'charge', value: 0, editLevel: 'Definition' },
      { id: 'bound-value', attributeId: 'bound', value: false, editLevel: 'Definition' },
    ] } });
    renderCatalog();

    await screen.findByText('Без группы');
    fireEvent.click(screen.getByRole('button', { name: 'Развернуть всё' }));
    fireEvent.click(await screen.findByRole('button', { name: /Public tonic/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Public tonic' });
    expect(within(dialog).getByText('Restores a little health.')).toBeInTheDocument();
    expect(within(dialog).getByText('Заряды')).toBeInTheDocument();
    expect(within(dialog).getByText('Связан')).toBeInTheDocument();
    expect(within(dialog).getByText('0')).toBeInTheDocument();
    expect(within(dialog).getByText('Нет')).toBeInTheDocument();
    expect(within(dialog).queryByRole('combobox', { name: 'Количество' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox', { name: 'Отрицательное' })).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Можно менять у персонажа')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox', { name: 'Название' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Настройки каталога')).not.toBeInTheDocument();
    expect(state.api.listCatalog).toHaveBeenCalledWith(12, 'Item');
    expect(screen.queryByRole('button', { name: 'Создать предмет' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать навык' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Атрибуты каталога' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Группы каталога' })).not.toBeInTheDocument();
    expect(state.api.getCatalogGroupConfiguration).not.toHaveBeenCalled();
    expect(state.api.putCatalogMetadata).not.toHaveBeenCalled();
    expect(state.api.putCatalogContent).not.toHaveBeenCalled();
    expect(state.api.createCatalogEntry).not.toHaveBeenCalled();
    expect(state.api.putCatalogAttributes).not.toHaveBeenCalled();
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();
  });

  it('switches item/skill tabs, searches the full current catalogue, and creates the selected kind', async () => {
    state.mode = 'gm';
    state.permissions = { canRead: true, canWrite: true, canManageAccess: false };
    state.api.getCatalogGroups.mockResolvedValue({
      campaignId: 12,
      contentRevision: 1,
      groups: [
        { id: 'group-root', title: 'Collections', parentId: null },
        { id: 'group-magic', title: 'Magic shelf', parentId: 'group-root' },
      ],
    });
    state.api.getCatalogGroupEntries.mockImplementation(async (_campaignId: number, kind: CatalogMetadata['kind'], groupId: string) => ({
      entries: kind === 'Skill' && groupId === 'group-magic' ? [skillMetadata] : [],
      diagnostics: [],
    }));
    state.api.createCatalogEntry.mockImplementation(async (_campaignId: number, kind: CatalogMetadata['kind'], request: CatalogCreateRequest) => {
      const entry: CatalogMetadata = {
        id: `created-${kind}`,
        campaignId: 12,
        name: request.name,
        kind,
        creatorUserId: 4,
        isHidden: request.isHidden,
        quantityUnit: request.quantityUnit ?? null,
        allowNegative: request.allowNegative,
        metadataRevision: 1,
      };
      return {
        entry,
        content: { ...content, resourceId: entry.id, data: { description: request.description, attributes: request.attributes } },
      };
    });
    renderCatalog('/groups/12/gm/catalog/items');

    expect(await screen.findByRole('button', { name: 'Атрибуты каталога' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Группы каталога' })).toBeInTheDocument();
    await screen.findByText('Без группы');
    fireEvent.click(screen.getByRole('button', { name: 'Развернуть всё' }));
    expect(screen.getByRole('button', { name: /Public tonic/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Arcana/ })).not.toBeInTheDocument();

    const itemTab = screen.getByRole('navigation', { name: 'Разделы каталога' });
    expect(within(itemTab).getByRole('link', { name: 'Предметы' })).toHaveAttribute('href', '/groups/12/gm/catalog/items');
    expect(within(itemTab).getByRole('link', { name: 'Навыки' })).toHaveAttribute('href', '/groups/12/gm/catalog/skills');
    fireEvent.click(within(itemTab).getByRole('link', { name: 'Навыки' }));
    await screen.findByText('Collections');
    expect(screen.queryByRole('button', { name: /Arcana/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Развернуть всё' }));
    expect(await screen.findByRole('button', { name: /Arcana/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Public tonic/ })).not.toBeInTheDocument();

    const search = screen.getByRole('textbox', { name: 'Поиск по названию' });
    fireEvent.change(search, { target: { value: 'Public' } });
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'Arcana' } });
    expect(await screen.findByRole('button', { name: /Arcana/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }));
    expect(await screen.findByRole('button', { name: /Arcana/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Public tonic/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Предметы' }));
    await screen.findByText('Без группы');
    fireEvent.click(screen.getByRole('button', { name: 'Развернуть всё' }));
    expect(await screen.findByRole('button', { name: /Public tonic/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Создать предмет' }));
    const itemDialog = await screen.findByRole('dialog', { name: 'Новый предмет' });
    expect(within(itemDialog).queryByRole('combobox', { name: 'Тип определения' })).not.toBeInTheDocument();
    fireEvent.change(within(itemDialog).getByRole('textbox', { name: 'Название' }), { target: { value: 'Created tonic' } });
    fireEvent.change(within(itemDialog).getByRole('combobox', { name: 'Количество' }), { target: { value: 'Fractional' } });
    fireEvent.click(within(itemDialog).getByRole('checkbox', { name: 'Отрицательное' }));
    fireEvent.click(within(itemDialog).getByRole('button', { name: 'Создать предмет' }));
    await waitFor(() => expect(state.api.createCatalogEntry).toHaveBeenCalledTimes(1));
    expect(state.api.createCatalogEntry.mock.calls[0][2]).toMatchObject({
      name: 'Created tonic',
      quantityUnit: 'Fractional',
      allowNegative: true,
    });
    expect(state.api.createCatalogEntry.mock.calls[0][1]).toBe('Item');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Новый предмет' })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('link', { name: 'Навыки' }));
    await screen.findByText('Collections');
    fireEvent.click(screen.getByRole('button', { name: 'Развернуть всё' }));
    expect(screen.queryByRole('button', { name: /Public tonic/ })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Arcana/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Создать навык' }));
    const skillDialog = await screen.findByRole('dialog', { name: 'Новый навык' });
    expect(within(skillDialog).queryByRole('combobox', { name: 'Тип определения' })).not.toBeInTheDocument();
    expect(within(skillDialog).queryByRole('combobox', { name: 'Количество' })).not.toBeInTheDocument();
    expect(within(skillDialog).queryByRole('checkbox', { name: 'Отрицательное' })).not.toBeInTheDocument();
    fireEvent.change(within(skillDialog).getByRole('textbox', { name: 'Название' }), { target: { value: 'Created skill' } });
    fireEvent.click(within(skillDialog).getByRole('button', { name: 'Создать навык' }));
    await waitFor(() => expect(state.api.createCatalogEntry).toHaveBeenCalledTimes(2));
    expect(state.api.createCatalogEntry.mock.calls[1][2]).toMatchObject({
      name: 'Created skill',
      quantityUnit: null,
      allowNegative: false,
    });
    expect(state.api.createCatalogEntry.mock.calls[1][1]).toBe('Skill');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Новый навык' })).not.toBeInTheDocument());
  });

  it('shows grouped attribute tags once per branch and reuses lazy content reads across expansion', async () => {
    const sharedEntry = { ...metadata, id: 'entry-shared', name: 'Shared relic' };
    const attribute = { id: 'attribute-type', title: 'Тип', typeKey: 'string' as const, options: [] };
    const taggedContent: CatalogContentEnvelope = {
      ...content,
      resourceId: sharedEntry.id,
      data: { description: '', attributes: [
        { id: 'occurrence-weapon', attributeId: attribute.id, value: 'Оружие', editLevel: 'Definition' },
        { id: 'occurrence-one-handed', attributeId: attribute.id, value: 'Одноручное', editLevel: 'Definition' },
        { id: 'occurrence-polearm', attributeId: attribute.id, value: 'Древковое', editLevel: 'Definition' },
      ] },
    };
    state.api.listCatalog.mockResolvedValue([sharedEntry]);
    state.api.getCatalogGroups.mockResolvedValue({
      campaignId: 12,
      contentRevision: 4,
      groups: [
        { id: 'group-root', title: 'Root group', parentId: null },
        { id: 'group-child', title: 'Child group', parentId: 'group-root' },
        { id: 'group-independent', title: 'Independent group', parentId: null },
      ],
    });
    state.api.getCatalogAttributes.mockResolvedValue({ campaignId: 12, contentRevision: 1, data: { definitions: [attribute] } });
    state.api.getCatalogGroupEntries.mockImplementation(async (_campaignId: number, _kind: CatalogMetadata['kind'], groupId: string) => ({
      entries: [sharedEntry],
      diagnostics: [],
    }));
    state.api.getCatalogContent.mockImplementation(async (_campaignId: number, _kind: CatalogMetadata['kind'], entryId: string) => ({ ...taggedContent, resourceId: entryId }));
    renderCatalog();

    await screen.findByText('Root group');
    expect(screen.getByText('Root group')).toBeInTheDocument();
    expect(state.api.getCatalogContent).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Shared relic' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Развернуть всё' }));
    const entryButtons = await screen.findAllByRole('button', { name: 'Shared relic' });
    expect(entryButtons).toHaveLength(2);
    await Promise.all(entryButtons.map(button => within(button).findByText('Тип: Оружие; Одноручное; Древковое')));
    expect(state.api.getCatalogContent).toHaveBeenCalledTimes(1);
    expect(state.api.getCatalogContent).toHaveBeenCalledWith(12, 'Item', sharedEntry.id);
    expect(state.api.getCatalogEntry).not.toHaveBeenCalled();
    const search = screen.getByRole('textbox', { name: 'Поиск по названию' });
    fireEvent.change(search, { target: { value: 'Одноручное' } });
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }));
    const membershipReadCount = state.api.getCatalogGroupEntries.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Свернуть всё' }));
    expect(screen.queryByRole('button', { name: 'Shared relic' })).not.toBeInTheDocument();
    expect(state.api.getCatalogContent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Развернуть всё' }));
    expect(await screen.findAllByRole('button', { name: 'Shared relic' })).toHaveLength(2);
    expect(state.api.getCatalogContent).toHaveBeenCalledTimes(1);
    expect(state.api.getCatalogGroupEntries).toHaveBeenCalledTimes(membershipReadCount);
    expect(state.api.getCatalogGroupConfiguration).not.toHaveBeenCalled();
    expect(state.api.createCatalogEntry).not.toHaveBeenCalled();
    expect(state.api.putCatalogMetadata).not.toHaveBeenCalled();
    expect(state.api.putCatalogContent).not.toHaveBeenCalled();
    expect(state.api.putCatalogAttributes).not.toHaveBeenCalled();
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();
  });

  it('keeps readable group sections when another membership fails and retries with reads only', async () => {
    const goodEntry = { ...metadata, id: 'entry-good', name: 'Readable tonic' };
    const failedEntry = { ...metadata, id: 'entry-retry', name: 'Recovered charm' };
    state.api.listCatalog.mockResolvedValue([goodEntry, failedEntry]);
    state.api.getCatalogGroups.mockResolvedValue({
      campaignId: 12,
      contentRevision: 6,
      groups: [
        { id: 'group-good', title: 'Readable group', parentId: null },
        { id: 'group-retry', title: 'Retry group', parentId: null },
      ],
    });
    state.api.getCatalogGroupEntries
      .mockImplementationOnce(async () => ({ entries: [goodEntry], diagnostics: [] }))
      .mockRejectedValueOnce(new Error('private error payload'))
      .mockImplementation(async (_campaignId: number, _kind: CatalogMetadata['kind'], groupId: string) => ({
        entries: groupId === 'group-good' ? [goodEntry] : [failedEntry],
        diagnostics: [],
      }));
    renderCatalog();

    await screen.findByText('Retry group');
    fireEvent.click(screen.getByRole('button', { name: 'Развернуть всё' }));
    expect(await screen.findByRole('button', { name: /Readable tonic/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить загрузку раздела' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Recovered charm/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Без группы')).not.toBeInTheDocument();
    expect(screen.queryByText('Ничего не найдено')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('private error payload');

    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку раздела' }));
    expect(await screen.findByRole('button', { name: /Recovered charm/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Readable tonic/ })).toBeInTheDocument();
    expect(state.api.getCatalogGroupConfiguration).not.toHaveBeenCalled();
    expect(state.api.createCatalogEntry).not.toHaveBeenCalled();
    expect(state.api.putCatalogMetadata).not.toHaveBeenCalled();
    expect(state.api.putCatalogContent).not.toHaveBeenCalled();
    expect(state.api.putCatalogAttributes).not.toHaveBeenCalled();
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();
  });

  it('refreshes the displayed name and attribute tags after sequential metadata and content saves', async () => {
    state.mode = 'gm';
    state.permissions = { canRead: true, canWrite: true, canManageAccess: false };
    const ownedEntry = { ...metadata, name: 'Old tonic', creatorUserId: 4 };
    const renamedEntry = { ...ownedEntry, name: 'Renamed tonic', metadataRevision: 2 };
    const attribute = { id: 'attribute-type', title: 'Тип', typeKey: 'string' as const, options: [] };
    const initialContent: CatalogContentEnvelope = {
      ...content,
      resourceId: ownedEntry.id,
      data: { description: '', attributes: [{
        id: 'occurrence-type', attributeId: attribute.id, value: 'Старое значение', editLevel: 'Definition',
      }] },
    };
    const savedContent: CatalogContentEnvelope = {
      ...initialContent,
      contentRevision: 2,
      data: { description: '', attributes: [{ ...initialContent.data.attributes[0], value: 'Новое значение' }] },
    };
    state.api.listCatalog.mockResolvedValue([ownedEntry]);
    state.api.getCatalogAttributes.mockResolvedValue({ campaignId: 12, contentRevision: 1, data: { definitions: [attribute] } });
    state.api.getCatalogContent.mockResolvedValue(initialContent);
    state.api.getCatalogEntry.mockResolvedValue(ownedEntry);
    state.api.putCatalogMetadata.mockResolvedValue(renamedEntry);
    state.api.putCatalogContent.mockResolvedValue(savedContent);
    renderCatalog('/groups/12/gm/catalog/items');

    await screen.findByText('Без группы');
    fireEvent.click(screen.getByRole('button', { name: 'Развернуть всё' }));
    const entryButton = await screen.findByRole('button', { name: 'Old tonic' });
    expect(await within(entryButton).findByText('Тип: Старое значение')).toBeInTheDocument();
    fireEvent.click(entryButton);
    const dialog = await screen.findByRole('dialog', { name: 'Old tonic' });
    expect(within(dialog).queryByRole('textbox', { name: 'Название' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Редактировать' }));
    await within(dialog).findByRole('textbox', { name: 'Название' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Название' }), { target: { value: 'Renamed tonic' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Значение: Тип' }), { target: { value: 'Новое значение' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отменить изменения' }));
    expect(confirm).toHaveBeenCalled();
    expect(within(dialog).queryByRole('textbox', { name: 'Название' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('Old tonic')).toBeInTheDocument();
    expect(state.api.putCatalogMetadata).not.toHaveBeenCalled();
    expect(state.api.putCatalogContent).not.toHaveBeenCalled();
    confirm.mockRestore();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Редактировать' }));
    await within(dialog).findByRole('textbox', { name: 'Название' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Название' }), { target: { value: 'Renamed tonic' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Значение: Тип' }), { target: { value: 'Новое значение' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(state.api.putCatalogMetadata).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(state.api.putCatalogContent).toHaveBeenCalledTimes(1));
    expect(state.api.putCatalogMetadata.mock.calls[0][3]).toMatchObject({ name: 'Renamed tonic', expectedRevision: 1 });
    expect(state.api.putCatalogContent.mock.calls[0][3]).toMatchObject({ attributes: [expect.objectContaining({ value: 'Новое значение' })] });
    await within(dialog).findByText('Изменения сохранены.');
    fireEvent.click(within(dialog).getByText('Закрыть', { selector: 'button' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Renamed tonic' })).not.toBeInTheDocument());
    const updatedEntryButton = await screen.findByRole('button', { name: 'Renamed tonic' });
    expect(await within(updatedEntryButton).findByText('Тип: Новое значение')).toBeInTheDocument();
    expect(within(updatedEntryButton).queryByText('Тип: Старое значение')).not.toBeInTheDocument();
    expect(state.api.createCatalogEntry).not.toHaveBeenCalled();
    expect(state.api.putCatalogAttributes).not.toHaveBeenCalled();
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();
  });
});

describe('catalog definition recovery and group editing', () => {
  beforeEach(resetApi);

  it('keeps the content draft after metadata succeeds and content conflicts, then writes only content at its reread revision', async () => {
    const ownedEntry = { ...metadata, name: 'Old tonic', creatorUserId: 4 };
    const initialContent = { ...content, resourceId: ownedEntry.id, contentRevision: 5, data: { description: 'Initial', attributes: [] } };
    const currentContent = { ...initialContent, contentRevision: 8, data: { description: 'Server copy', attributes: [] } };
    const savedMetadata = { ...ownedEntry, name: 'Renamed tonic', metadataRevision: 2 };
    state.api.getCatalogEntry.mockResolvedValueOnce(ownedEntry).mockResolvedValueOnce(savedMetadata);
    state.api.getCatalogContent.mockResolvedValueOnce(initialContent).mockResolvedValueOnce(initialContent).mockResolvedValueOnce(currentContent);
    state.api.putCatalogMetadata.mockResolvedValue(savedMetadata);
    state.api.putCatalogContent
      .mockRejectedValueOnce(new CampaignApiError(409, { code: 'content_revision_conflict', title: 'Conflict', detail: 'stale' }))
      .mockImplementationOnce(async (_campaignId: number, _kind: CatalogMetadata['kind'], _entryId: string, body: { expectedRevision: number; description: string; attributes: [] }) => ({
        ...currentContent,
        contentRevision: body.expectedRevision + 1,
        data: { description: body.description, attributes: body.attributes },
      }));

    renderDefinition({ entryId: ownedEntry.id });
    const dialog = await screen.findByRole('dialog', { name: 'Old tonic' });
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Редактировать' }));
    await within(dialog).findByRole('textbox', { name: 'Название' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Название' }), { target: { value: 'Renamed tonic' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Описание' }), { target: { value: 'My content draft' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    expect(await within(dialog).findByRole('button', { name: 'Проверить актуальные данные' })).toBeInTheDocument();
    expect(state.api.putCatalogMetadata).toHaveBeenCalledTimes(1);
    expect(state.api.putCatalogContent).toHaveBeenCalledTimes(1);
    expect(state.api.putCatalogMetadata.mock.calls[0][3]).toMatchObject({
      name: 'Renamed tonic',
      expectedRevision: 1,
    });
    expect(state.api.putCatalogContent.mock.calls[0][3]).toMatchObject({
      expectedRevision: 5,
      description: 'My content draft',
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Проверить актуальные данные' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Оставить мой черновик' }));
    expect(within(dialog).getByRole('textbox', { name: 'Описание' })).toHaveValue('My content draft');
    expect(state.api.putCatalogContent).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(state.api.putCatalogContent).toHaveBeenCalledTimes(2));
    expect(state.api.putCatalogMetadata).toHaveBeenCalledTimes(1);
    expect(state.api.putCatalogContent.mock.calls[1][3]).toMatchObject({
      expectedRevision: 8,
      description: 'My content draft',
    });
  });

  it('keeps an uncertain publication blocked and checks only the same request ID with reads', async () => {
    state.api.createCatalogEntry.mockRejectedValueOnce(new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown', detail: 'network' }, true));
    state.api.getCatalogEntry.mockRejectedValue(new Error('not published yet'));
    state.api.getCatalogContent.mockRejectedValue(new Error('not published yet'));
    renderDefinition({ canAdmin: true });

    const dialog = await screen.findByRole('dialog', { name: 'Новый предмет' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Название' }), { target: { value: 'New tonic' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать предмет' }));

    const checkButton = await within(dialog).findByRole('button', { name: 'Проверить результат' });
    await waitFor(() => expect(state.api.createCatalogEntry).toHaveBeenCalledTimes(1));
    const requestId = state.api.createCatalogEntry.mock.calls[0][2].requestId;
    expect(state.api.getCatalogEntry).toHaveBeenLastCalledWith(12, 'Item', requestId);
    expect(state.api.getCatalogContent).toHaveBeenLastCalledWith(12, 'Item', requestId);
    expect(state.api.createCatalogEntry.mock.calls[0][2]).toMatchObject({
      requestId,
      name: 'New tonic',
      quantityUnit: 'Whole',
      allowNegative: false,
    });

    fireEvent.click(checkButton);
    await waitFor(() => expect(state.api.getCatalogEntry).toHaveBeenCalledTimes(2));
    expect(state.api.getCatalogContent).toHaveBeenCalledTimes(2);
    expect(state.api.createCatalogEntry).toHaveBeenCalledTimes(1);
    expect(state.api.createCatalogEntry.mock.calls[0][2].requestId).toBe(requestId);
    expect(within(dialog).getByRole('button', { name: 'Проверить результат' })).toBeInTheDocument();
    expect(within(dialog).queryByText('not published yet')).not.toBeInTheDocument();
  });

  it('preserves a stale group predicate verbatim when only its title changes', async () => {
    const staleCondition = {
      operator: 'eq' as const,
      attributeId: 'attribute-strength',
      value: 2,
    };
    const group = {
      id: 'group-strength',
      title: 'Old title',
      parentId: null,
      entryIds: [metadata.id],
      condition: staleCondition,
    };
    state.api.getCatalogGroupConfiguration.mockResolvedValue({
      campaignId: 12,
      contentRevision: 5,
      data: { groups: [group] },
      diagnostics: [{ groupId: group.id, entryId: null, code: 'incompatible_attribute_type' }],
    });
    state.api.listCatalog.mockResolvedValue([metadata]);
    state.api.getCatalogAttributes.mockResolvedValue({
      campaignId: 12,
      contentRevision: 2,
      data: { definitions: [{ id: 'attribute-strength', title: 'Strength', typeKey: 'string', options: [] }] },
    });
    const savedConfiguration = {
      campaignId: 12,
      contentRevision: 6,
      data: { groups: [{ ...group, title: 'Renamed group' }] },
      diagnostics: [{ groupId: group.id, entryId: null, code: 'incompatible_attribute_type' }],
    };
    state.api.putCatalogGroups.mockResolvedValue(savedConfiguration);

    renderGroupsDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Группы каталога' });
    const title = within(dialog).getByRole('textbox', { name: 'Название группы' });
    fireEvent.change(title, { target: { value: 'Renamed group' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить группы' }));

    await waitFor(() => expect(state.api.putCatalogGroups).toHaveBeenCalledTimes(1));
    expect(state.api.putCatalogGroups.mock.calls[0][2]).toEqual({
      expectedRevision: 5,
      groups: [{
        id: group.id,
        title: 'Renamed group',
        parentId: null,
        entryIds: [metadata.id],
        condition: staleCondition,
      }],
    });
  });

  it('keeps membership and condition edits local until one full group save', async () => {
    const hiddenEntry = { ...metadata, id: 'entry-hidden', name: 'Hidden tonic', isHidden: true };
    const secondEntry = { ...metadata, id: 'entry-second', name: 'Second tonic' };
    const firstGroup = {
      id: 'group-first',
      title: 'First group',
      parentId: null,
      entryIds: [hiddenEntry.id, 'unavailable-entry'],
      condition: null,
    };
    const secondGroup = {
      id: 'group-second',
      title: 'Second group',
      parentId: firstGroup.id,
      entryIds: [secondEntry.id],
      condition: null,
    };
    state.api.listCatalog.mockResolvedValue([hiddenEntry, secondEntry]);
    state.api.getCatalogGroupConfiguration.mockResolvedValue({
      campaignId: 12,
      contentRevision: 11,
      data: { groups: [firstGroup, secondGroup] },
      diagnostics: [],
    });
    state.api.getCatalogAttributes.mockResolvedValue({
      campaignId: 12,
      contentRevision: 4,
      data: { definitions: [{ id: 'attribute-power', title: 'Power', typeKey: 'integer', options: [] }] },
    });
    state.api.putCatalogGroups.mockResolvedValue({
      campaignId: 12,
      contentRevision: 12,
      data: { groups: [firstGroup, secondGroup] },
      diagnostics: [],
    });
    renderGroupsDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Группы каталога' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Состав: First group' }));
    const cancelledMembers = await screen.findByRole('dialog', { name: 'Состав: First group' });
    fireEvent.click(within(cancelledMembers).getByRole('checkbox', { name: 'Включить Second tonic в группу' }));
    fireEvent.click(within(cancelledMembers).getByRole('checkbox', { name: 'Убрать недоступную запись 1 из группы' }));
    fireEvent.click(within(cancelledMembers).getByRole('button', { name: 'Отмена' }));
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Состав: First group' }));
    const members = await screen.findByRole('dialog', { name: 'Состав: First group' });
    expect(within(members).getByRole('checkbox', { name: 'Включить Hidden tonic в группу' })).toBeChecked();
    expect(within(members).getByRole('checkbox', { name: 'Убрать недоступную запись 1 из группы' })).toBeChecked();
    expect(within(members).getByRole('checkbox', { name: 'Включить Second tonic в группу' })).not.toBeChecked();
    fireEvent.change(within(members).getByRole('textbox', { name: 'Поиск предметов и навыков' }), { target: { value: 'Second' } });
    fireEvent.click(within(members).getByRole('checkbox', { name: 'Включить Second tonic в группу' }));
    fireEvent.click(within(members).getByRole('button', { name: 'Применить' }));
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Условие: First group' }));
    const cancelledCondition = await screen.findByRole('dialog', { name: 'Условие: First group' });
    fireEvent.change(within(cancelledCondition).getByRole('combobox', { name: 'Условие включения' }), { target: { value: 'eq' } });
    fireEvent.change(within(cancelledCondition).getByRole('combobox', { name: 'Атрибут' }), { target: { value: 'attribute-power' } });
    fireEvent.change(await within(cancelledCondition).findByRole('textbox', { name: 'Значение: Power' }), { target: { value: '-' } });
    await waitFor(() => expect(within(cancelledCondition).getByRole('button', { name: 'Применить' })).toBeDisabled());
    fireEvent.click(within(cancelledCondition).getByRole('button', { name: 'Отмена' }));
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Условие: First group' }));
    const condition = await screen.findByRole('dialog', { name: 'Условие: First group' });
    expect(within(condition).getByRole('combobox', { name: 'Условие включения' })).toHaveValue('none');
    fireEvent.change(within(condition).getByRole('combobox', { name: 'Условие включения' }), { target: { value: 'eq' } });
    fireEvent.change(within(condition).getByRole('combobox', { name: 'Атрибут' }), { target: { value: 'attribute-power' } });
    fireEvent.change(await within(condition).findByRole('textbox', { name: 'Значение: Power' }), { target: { value: '7' } });
    await waitFor(() => expect(within(condition).getByRole('button', { name: 'Применить' })).toBeEnabled());
    fireEvent.click(within(condition).getByRole('button', { name: 'Применить' }));
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить группы' }));
    await waitFor(() => expect(state.api.putCatalogGroups).toHaveBeenCalledTimes(1));
    const submitted = state.api.putCatalogGroups.mock.calls[0][2];
    expect(submitted.expectedRevision).toBe(11);
    expect(submitted.groups).toMatchObject([
      {
        id: firstGroup.id,
        title: firstGroup.title,
        parentId: null,
        entryIds: [hiddenEntry.id, 'unavailable-entry', secondEntry.id],
      },
      {
        id: secondGroup.id,
        title: secondGroup.title,
        parentId: firstGroup.id,
        entryIds: [secondEntry.id],
        condition: null,
      },
    ]);
    expect(stringifyJson(submitted.groups[0].condition)).toBe(
      '{"operator":"eq","attributeId":"attribute-power","value":7}',
    );
    expect(state.api.putCatalogMetadata).not.toHaveBeenCalled();
    expect(state.api.putCatalogAttributes).not.toHaveBeenCalled();
  });

  it('requires moving children before removing a group and only saves the remaining group configuration', async () => {
    const parent = { id: 'group-parent', title: 'Parent', parentId: null, entryIds: [metadata.id], condition: null };
    const child = { id: 'group-child', title: 'Child', parentId: parent.id, entryIds: [], condition: null };
    state.api.getCatalogGroupConfiguration.mockResolvedValue({
      campaignId: 12,
      contentRevision: 3,
      data: { groups: [parent, child] },
      diagnostics: [],
    });
    state.api.listCatalog.mockResolvedValue([metadata]);
    state.api.putCatalogGroups.mockResolvedValue({
      campaignId: 12,
      contentRevision: 4,
      data: { groups: [{ ...child, parentId: null }] },
      diagnostics: [],
    });
    renderGroupsDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Группы каталога' });
    const parentDelete = within(dialog).getByRole('button', { name: 'Удалить группу Parent' });
    expect(parentDelete).toBeDisabled();
    fireEvent.click(parentDelete);
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Переместить группу Child' }));
    const moveDialog = await screen.findByRole('dialog', { name: 'Переместить группу: Child' });
    fireEvent.change(within(moveDialog).getByRole('combobox', { name: 'Родительская группа' }), { target: { value: '' } });
    fireEvent.click(within(moveDialog).getByRole('button', { name: 'Применить' }));
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Удалить группу Parent' })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить группу Parent' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить группы' }));
    await waitFor(() => expect(state.api.putCatalogGroups).toHaveBeenCalledTimes(1));
    expect(state.api.putCatalogGroups.mock.calls[0][2]).toEqual({
      expectedRevision: 3,
      groups: [{ id: child.id, title: child.title, parentId: null, entryIds: [], condition: null }],
    });
    expect(state.api.putCatalogMetadata).not.toHaveBeenCalled();
    expect(state.api.putCatalogAttributes).not.toHaveBeenCalled();
  });

  it('stages nested unsaved groups while preserving the full draft through collapse and expansion', async () => {
    const root: CatalogGroup = { id: 'saved-root', title: 'Root', parentId: null, entryIds: [], condition: null };
    const other: CatalogGroup = { id: 'saved-other', title: 'Other root', parentId: null, entryIds: [], condition: null };
    let confirmedGroups: CatalogGroup[] = [root, other];
    let revision = 8;
    let generatedId = 0;
    state.api.getCatalogGroupConfiguration.mockResolvedValue({ campaignId: 12, contentRevision: revision, data: { groups: confirmedGroups }, diagnostics: [] });
    state.api.listCatalog.mockResolvedValue([]);
    state.api.getCatalogAttributes.mockResolvedValue({ campaignId: 12, contentRevision: 0, data: { definitions: [] } });
    state.api.putCatalogGroups.mockImplementation(async (_campaignId: number, _kind: CatalogMetadata['kind'], body: GroupPutBody) => {
      const existingIds = new Set(confirmedGroups.map(group => group.id));
      const assigned: CatalogGroup[] = body.groups.map((group): CatalogGroup => {
        if (group.id && !existingIds.has(group.id)) throw new Error('A new group ID was supplied to the server.');
        return { ...group, id: group.id ?? `server-group-${++generatedId}` };
      });
      const assignedIds = new Set(assigned.map(group => group.id));
      if (assignedIds.size !== assigned.length || assigned.some(group => group.parentId && !assignedIds.has(group.parentId))) {
        throw new Error('The submitted group configuration has invalid IDs or parents.');
      }
      confirmedGroups = assigned;
      revision += 1;
      const result: CatalogGroupConfigurationEnvelope = { campaignId: 12, contentRevision: revision, data: { groups: confirmedGroups }, diagnostics: [] };
      state.api.getCatalogGroupConfiguration.mockResolvedValue(result);
      return result;
    });
    renderGroupsDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Группы каталога' });

    const rootInput = screen.getAllByRole('textbox', { name: 'Название группы' }).find(input => (input as HTMLInputElement).value === 'Root');
    if (!rootInput) throw new Error('The saved root group title input was not found.');
    fireEvent.change(rootInput, { target: { value: 'Renamed root' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить дочернюю группу: Renamed root' }));
    await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Название группы' }).some(input => input === document.activeElement)).toBe(true));
    changeFocusedGroupTitle('Child');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить дочернюю группу: Child' }));
    await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Название группы' }).some(input => input === document.activeElement)).toBe(true));
    changeFocusedGroupTitle('Grandchild');
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Свернуть группу Renamed root' }));
    expect(within(dialog).queryByRole('button', { name: 'Состав: Child' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Развернуть группу Renamed root' }));
    expect(screen.getAllByRole('textbox', { name: 'Название группы' }).some(input => (input as HTMLInputElement).value === 'Child')).toBe(true);
    expect(screen.getAllByRole('textbox', { name: 'Название группы' }).some(input => (input as HTMLInputElement).value === 'Grandchild')).toBe(true);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Состав: Renamed root' }));
    fireEvent.click(await within(await screen.findByRole('dialog', { name: 'Состав: Renamed root' })).findByRole('button', { name: 'Отмена' }));
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить группы' }));
    await waitFor(() => expect(state.api.putCatalogGroups).toHaveBeenCalledTimes(2));

    const firstStage = state.api.putCatalogGroups.mock.calls[0][2] as GroupPutBody;
    expect(firstStage).toEqual({
      expectedRevision: 8,
      groups: [
        { id: root.id, title: root.title, parentId: null, entryIds: [], condition: null },
        { id: other.id, title: other.title, parentId: null, entryIds: [], condition: null },
        { title: 'Child', parentId: root.id, entryIds: [], condition: null },
      ],
    });
    const finalStage = state.api.putCatalogGroups.mock.calls[1][2] as GroupPutBody;
    expect(finalStage).toEqual({
      expectedRevision: 9,
      groups: [
        { id: root.id, title: 'Renamed root', parentId: null, entryIds: [], condition: null },
        { id: other.id, title: other.title, parentId: null, entryIds: [], condition: null },
        { id: 'server-group-1', title: 'Child', parentId: root.id, entryIds: [], condition: null },
        { title: 'Grandchild', parentId: 'server-group-1', entryIds: [], condition: null },
      ],
    });
    expect(finalStage.groups.every(group => !('parentKey' in group))).toBe(true);
    expect(new Set(confirmedGroups.map(group => group.id)).size).toBe(confirmedGroups.length);
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Сохранить группы' })).toBeDisabled());
  });

  it('retains a confirmed parent and draft descendants after an unknown staged creation without retrying', async () => {
    const root: CatalogGroup = { id: 'saved-root', title: 'Root', parentId: null, entryIds: [], condition: null };
    let confirmedGroups: CatalogGroup[] = [root];
    let revision = 30;
    state.api.getCatalogGroupConfiguration.mockResolvedValue({ campaignId: 12, contentRevision: revision, data: { groups: confirmedGroups }, diagnostics: [] });
    state.api.listCatalog.mockResolvedValue([]);
    state.api.getCatalogAttributes.mockResolvedValue({ campaignId: 12, contentRevision: 0, data: { definitions: [] } });
    state.api.putCatalogGroups
      .mockImplementationOnce(async (_campaignId: number, _kind: CatalogMetadata['kind'], body: GroupPutBody) => {
        const priorIds = new Set(confirmedGroups.map(group => group.id));
        const assigned: CatalogGroup[] = body.groups.map((group): CatalogGroup => {
          if (group.id && !priorIds.has(group.id)) throw new Error('A new group ID was supplied to the server.');
          return { ...group, id: group.id ?? 'server-child' };
        });
        const assignedIds = new Set(assigned.map(group => group.id));
        if (assigned.some(group => group.parentId && !assignedIds.has(group.parentId))) throw new Error('A parent was not included in the request.');
        confirmedGroups = assigned;
        revision += 1;
        const result = { campaignId: 12, contentRevision: revision, data: { groups: confirmedGroups }, diagnostics: [] };
        state.api.getCatalogGroupConfiguration.mockResolvedValue(result);
        return result;
      })
      .mockRejectedValueOnce(new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown outcome', detail: 'network failure' }, true));
    renderGroupsDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Группы каталога' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить дочернюю группу: Root' }));
    await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Название группы' }).some(input => input === document.activeElement)).toBe(true));
    changeFocusedGroupTitle('Child');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить дочернюю группу: Child' }));
    await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Название группы' }).some(input => input === document.activeElement)).toBe(true));
    changeFocusedGroupTitle('Grandchild');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Свернуть группу Root' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Развернуть группу Root' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Состав: Root' }));
    const members = await screen.findByRole('dialog', { name: 'Состав: Root' });
    fireEvent.click(within(members).getByRole('button', { name: 'Отмена' }));
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить группы' }));
    await waitFor(() => expect(state.api.putCatalogGroups).toHaveBeenCalledTimes(2));
    expect(confirmedGroups.map(group => group.id)).toEqual([root.id, 'server-child']);
    expect(state.api.putCatalogGroups.mock.calls[0][2]).toEqual({
      expectedRevision: 30,
      groups: [
        { id: root.id, title: root.title, parentId: null, entryIds: [], condition: null },
        { title: 'Child', parentId: root.id, entryIds: [], condition: null },
      ],
    });
    expect(state.api.putCatalogGroups.mock.calls[1][2]).toEqual({
      expectedRevision: 31,
      groups: [
        { id: root.id, title: root.title, parentId: null, entryIds: [], condition: null },
        { id: 'server-child', title: 'Child', parentId: root.id, entryIds: [], condition: null },
        { title: 'Grandchild', parentId: 'server-child', entryIds: [], condition: null },
      ],
    });
    expect(await screen.findByRole('heading', { name: 'Восстановление конфигурации' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Оставить черновик с новой ревизией' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: 'Название группы' }).some(input => (input as HTMLInputElement).value === 'Grandchild')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Перечитать группы и состав' }));
    expect(await screen.findByRole('button', { name: 'Принять серверную конфигурацию' })).toBeInTheDocument();
    expect(state.api.putCatalogGroups).toHaveBeenCalledTimes(2);
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Принять серверную конфигурацию' }));
    confirmation.mockRestore();
    expect(state.api.putCatalogGroups).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole('textbox', { name: 'Название группы' }).some(input => (input as HTMLInputElement).value === 'Grandchild')).toBe(false);
    expect(state.api.createCatalogEntry).not.toHaveBeenCalled();
  });
});

describe('catalog attribute schema options', () => {
  beforeEach(resetApi);

  it('discards cancelled option edits and saves applied option changes only with the outer schema revision', async () => {
    state.mode = 'gm';
    state.permissions = { canRead: true, canWrite: true, canManageAccess: false };
    const definition = {
      id: 'attr-tags',
      title: 'Tags',
      typeKey: 'multiChoice' as const,
      options: [
        { optionKey: 'option-stealth', title: 'Stealth' },
        { optionKey: 'option-lore', title: 'Lore' },
      ],
    };
    const schema = {
      campaignId: 12,
      contentRevision: 7,
      data: { definitions: [definition] },
    };
    state.api.getCatalogAttributes.mockResolvedValue(schema);
    state.api.putCatalogAttributes.mockResolvedValue({
      ...schema,
      contentRevision: 8,
      data: { definitions: [{ ...definition, options: [{ optionKey: 'option-stealth', title: 'Quiet' }] }] },
    });
    renderCatalog('/groups/12/gm/catalog/items');
    fireEvent.click(await screen.findByRole('button', { name: 'Атрибуты каталога' }));
    const schemaDialog = await screen.findByRole('dialog', { name: 'Схема атрибутов каталога' });

    fireEvent.click(within(schemaDialog).getByRole('button', { name: 'Варианты (2)' }));
    const cancelledOptions = await screen.findByRole('dialog', { name: 'Варианты: Tags' });
    fireEvent.change(within(cancelledOptions).getByRole('textbox', { name: 'Название варианта 1' }), { target: { value: 'Discarded' } });
    fireEvent.click(within(cancelledOptions).getByRole('button', { name: 'Отмена' }));
    expect(state.api.putCatalogAttributes).not.toHaveBeenCalled();
    expect(within(schemaDialog).getByRole('button', { name: 'Варианты (2)' })).toBeInTheDocument();

    fireEvent.click(within(schemaDialog).getByRole('button', { name: 'Варианты (2)' }));
    const optionsDialog = await screen.findByRole('dialog', { name: 'Варианты: Tags' });
    expect(within(optionsDialog).getByRole('textbox', { name: 'Название варианта 1' })).toHaveValue('Stealth');
    fireEvent.change(within(optionsDialog).getByRole('textbox', { name: 'Название варианта 1' }), { target: { value: 'Quiet' } });
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(within(optionsDialog).getAllByRole('button', { name: 'Удалить вариант' })[1]);
    expect(confirmation).toHaveBeenCalledWith('Удаление варианта может сделать сохранённые значения несовместимыми. Удалить вариант?');
    confirmation.mockRestore();
    fireEvent.click(within(optionsDialog).getByRole('button', { name: 'Применить' }));
    expect(state.api.putCatalogAttributes).not.toHaveBeenCalled();
    expect(within(schemaDialog).getByRole('button', { name: 'Варианты (1)' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('option-stealth');

    fireEvent.click(within(schemaDialog).getByRole('button', { name: 'Сохранить схему' }));
    await waitFor(() => expect(state.api.putCatalogAttributes).toHaveBeenCalledTimes(1));
    expect(state.api.putCatalogAttributes.mock.calls[0][2]).toEqual({
      expectedRevision: 7,
      definitions: [{
        id: 'attr-tags',
        title: 'Tags',
        typeKey: 'multiChoice',
        options: [{ optionKey: 'option-stealth', title: 'Quiet' }],
      }],
    });
  });
});
