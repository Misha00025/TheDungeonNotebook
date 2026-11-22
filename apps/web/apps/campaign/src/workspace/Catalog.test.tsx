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
import type { CatalogContentEnvelope, CatalogMetadata } from './catalogTypes';

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

const renderCatalog = (path = '/groups/12/player/catalog') => render(
  <RemoteAuthProvider auth={responseAuth()}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/groups/:groupId/player/catalog" element={<Catalog kind="Item" />} />
        <Route path="/groups/:groupId/player/catalog/skills" element={<Catalog kind="Skill" />} />
        <Route path="/groups/:groupId/gm/catalog" element={<Catalog kind="Item" />} />
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
  attributeSchemaRevision: 0,
  data: { description: 'Restores a little health.', attributes: [] },
  diagnostics: [],
};

function resetApi() {
  Object.values(state.api).forEach(method => method.mockReset());
  state.sessionKey = 'user-4';
  state.userId = 4;
  state.mode = 'player';
  state.permissionsLoading = false;
  state.permissions = { canRead: true, canWrite: false, canManageAccess: false };
  state.api.listCatalog.mockResolvedValue([metadata, skillMetadata]);
  state.api.getCatalogGroups.mockResolvedValue({ campaignId: 12, contentRevision: 0, groups: [] });
  state.api.getCatalogAttributes.mockResolvedValue({ campaignId: 12, contentRevision: 0, data: { definitions: [] } });
  state.api.getCatalogGroupEntries.mockResolvedValue({ entries: [], diagnostics: [] });
  state.api.getCatalogEntry.mockResolvedValue(metadata);
  state.api.getCatalogContent.mockResolvedValue(content);
  state.api.createCatalogEntry.mockResolvedValue({ entry: metadata, content });
  state.api.putCatalogMetadata.mockResolvedValue({ ...metadata, metadataRevision: 2 });
  state.api.putCatalogContent.mockResolvedValue({ ...content, contentRevision: 2 });
  state.api.putCatalogAttributes.mockResolvedValue({ campaignId: 12, contentRevision: 1, data: { definitions: [] } });
  state.api.getCatalogGroupConfiguration.mockResolvedValue({ campaignId: 12, contentRevision: 0, data: { groups: [] }, attributeSchemaRevision: 0, diagnostics: [] });
  state.api.putCatalogGroups.mockResolvedValue({ campaignId: 12, contentRevision: 1, data: { groups: [] }, attributeSchemaRevision: 0, diagnostics: [] });
}

const renderDefinition = (props: Partial<React.ComponentProps<typeof CatalogDefinitionDialog>> = {}) => render(
  <RemoteAuthProvider auth={responseAuth()}>
    <MemoryRouter>
      <CatalogDefinitionDialog
        campaignId={12}
        canAdmin={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onForbidden={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  </RemoteAuthProvider>,
);

const renderGroupsDialog = () => render(
  <MemoryRouter>
    <CatalogGroupsDialog
      campaignId={12}
      canManage
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onForbidden={vi.fn()}
    />
  </MemoryRouter>,
);

describe('campaign catalog', () => {
  beforeEach(resetApi);

  it('lets a player browse server-visible metadata without admin configuration access and opens another creator’s entry read-only', async () => {
    renderCatalog();

    fireEvent.click(await screen.findByRole('button', { name: /Public tonic/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Public tonic' });
    expect(within(dialog).getByText('Restores a little health.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox', { name: 'Название' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Сохранить' })).not.toBeInTheDocument();
    expect(state.api.listCatalog).toHaveBeenCalledWith(12);
    expect(screen.queryByRole('button', { name: 'Создать определение' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Атрибуты каталога' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Группы каталога' })).not.toBeInTheDocument();
    expect(state.api.getCatalogGroupConfiguration).not.toHaveBeenCalled();
    expect(state.api.putCatalogMetadata).not.toHaveBeenCalled();
    expect(state.api.putCatalogContent).not.toHaveBeenCalled();
    expect(state.api.createCatalogEntry).not.toHaveBeenCalled();
    expect(state.api.putCatalogAttributes).not.toHaveBeenCalled();
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();
  });

  it('switches item/skill tabs, filters group entries and search locally, and creates the selected kind', async () => {
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
    state.api.getCatalogGroupEntries.mockResolvedValue({ entries: [metadata, skillMetadata], diagnostics: [] });
    renderCatalog('/groups/12/gm/catalog');

    expect(await screen.findByRole('button', { name: 'Атрибуты каталога' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Группы каталога' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Public tonic/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Arcana/ })).not.toBeInTheDocument();

    const itemTab = screen.getByRole('navigation', { name: 'Разделы каталога' });
    expect(within(itemTab).getByRole('link', { name: 'Предметы' })).toHaveAttribute('href', '/groups/12/gm/catalog/');
    expect(within(itemTab).getByRole('link', { name: 'Навыки' })).toHaveAttribute('href', '/groups/12/gm/catalog/skills');
    fireEvent.click(within(itemTab).getByRole('link', { name: 'Навыки' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Arcana/ })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Public tonic/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Magic shelf' }));
    await waitFor(() => expect(state.api.getCatalogGroupEntries).toHaveBeenCalledWith(12, 'group-magic'));
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

    fireEvent.click(screen.getByRole('button', { name: 'Создать определение' }));

    const dialog = await screen.findByRole('dialog', { name: 'Новое определение' });
    expect(within(dialog).getByRole('combobox', { name: 'Тип определения' })).toHaveValue('Skill');
  });
});

describe('catalog definition recovery', () => {
  beforeEach(resetApi);

  it('keeps the content draft after metadata succeeds and content conflicts, then writes only content at its reread revision', async () => {
    const ownedEntry = { ...metadata, name: 'Old tonic', creatorUserId: 4 };
    const initialContent = { ...content, resourceId: ownedEntry.id, contentRevision: 5, data: { description: 'Initial', attributes: [] } };
    const currentContent = { ...initialContent, contentRevision: 8, data: { description: 'Server copy', attributes: [] } };
    const savedMetadata = { ...ownedEntry, name: 'Renamed tonic', metadataRevision: 2 };
    state.api.getCatalogEntry.mockResolvedValueOnce(ownedEntry).mockResolvedValueOnce(savedMetadata);
    state.api.getCatalogContent.mockResolvedValueOnce(initialContent).mockResolvedValueOnce(currentContent);
    state.api.putCatalogMetadata.mockResolvedValue(savedMetadata);
    state.api.putCatalogContent
      .mockRejectedValueOnce(new CampaignApiError(409, { code: 'content_revision_conflict', title: 'Conflict', detail: 'stale' }))
      .mockImplementationOnce(async (_campaignId: number, _entryId: string, body: { expectedRevision: number; description: string; attributes: [] }) => ({
        ...currentContent,
        contentRevision: body.expectedRevision + 1,
        data: { description: body.description, attributes: body.attributes },
      }));

    renderDefinition({ entryId: ownedEntry.id });
    const dialog = await screen.findByRole('dialog', { name: 'Old tonic' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Название' }), { target: { value: 'Renamed tonic' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Описание' }), { target: { value: 'My content draft' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    expect(await within(dialog).findByRole('button', { name: 'Перечитать серверные данные' })).toBeInTheDocument();
    expect(state.api.putCatalogMetadata).toHaveBeenCalledTimes(1);
    expect(state.api.putCatalogContent).toHaveBeenCalledTimes(1);
    expect(state.api.putCatalogMetadata.mock.calls[0][2]).toMatchObject({
      name: 'Renamed tonic',
      expectedRevision: 1,
    });
    expect(state.api.putCatalogContent.mock.calls[0][2]).toMatchObject({
      expectedRevision: 5,
      description: 'My content draft',
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Перечитать серверные данные' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Оставить мой черновик' }));
    expect(within(dialog).getByRole('textbox', { name: 'Описание' })).toHaveValue('My content draft');
    expect(state.api.putCatalogContent).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(state.api.putCatalogContent).toHaveBeenCalledTimes(2));
    expect(state.api.putCatalogMetadata).toHaveBeenCalledTimes(1);
    expect(state.api.putCatalogContent.mock.calls[1][2]).toMatchObject({
      expectedRevision: 8,
      description: 'My content draft',
    });
  });

  it('keeps an uncertain publication blocked and checks only the same request ID with reads', async () => {
    state.api.createCatalogEntry.mockRejectedValueOnce(new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown', detail: 'network' }, true));
    state.api.getCatalogEntry.mockRejectedValue(new Error('not published yet'));
    state.api.getCatalogContent.mockRejectedValue(new Error('not published yet'));
    renderDefinition({ canAdmin: true });

    const dialog = await screen.findByRole('dialog', { name: 'Новое определение' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Название' }), { target: { value: 'New tonic' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    const checkButton = await within(dialog).findByRole('button', { name: 'Проверить результат' });
    await waitFor(() => expect(state.api.createCatalogEntry).toHaveBeenCalledTimes(1));
    const requestId = state.api.createCatalogEntry.mock.calls[0][1].requestId;
    expect(state.api.getCatalogEntry).toHaveBeenLastCalledWith(12, requestId);
    expect(state.api.getCatalogContent).toHaveBeenLastCalledWith(12, requestId);

    fireEvent.click(checkButton);
    await waitFor(() => expect(state.api.getCatalogEntry).toHaveBeenCalledTimes(2));
    expect(state.api.getCatalogContent).toHaveBeenCalledTimes(2);
    expect(state.api.createCatalogEntry).toHaveBeenCalledTimes(1);
    expect(state.api.createCatalogEntry.mock.calls[0][1].requestId).toBe(requestId);
    expect(within(dialog).getByRole('button', { name: 'Проверить результат' })).toBeInTheDocument();
    expect(within(dialog).queryByText('not published yet')).not.toBeInTheDocument();
  });

  it('preserves a stale group predicate verbatim when only its title changes', async () => {
    const staleCondition = {
      operator: 'eq' as const,
      attributeId: 'attribute-strength',
      typeKey: 'integer',
      typeRevision: 1,
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
      attributeSchemaRevision: 2,
      diagnostics: [{ groupId: group.id, entryId: null, code: 'incompatible_attribute_type' }],
    });
    state.api.listCatalog.mockResolvedValue([metadata]);
    state.api.getCatalogAttributes.mockResolvedValue({
      campaignId: 12,
      contentRevision: 2,
      data: { definitions: [{ id: 'attribute-strength', title: 'Strength', typeKey: 'integer', typeRevision: 2, options: [], isActive: true }] },
    });
    const savedConfiguration = {
      campaignId: 12,
      contentRevision: 6,
      data: { groups: [{ ...group, title: 'Renamed group' }] },
      attributeSchemaRevision: 2,
      diagnostics: [{ groupId: group.id, entryId: null, code: 'incompatible_attribute_type' }],
    };
    state.api.putCatalogGroups.mockResolvedValue(savedConfiguration);

    renderGroupsDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Группы каталога' });
    const title = within(dialog).getByRole('textbox', { name: 'Название группы' });
    fireEvent.change(title, { target: { value: 'Renamed group' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить группы' }));

    await waitFor(() => expect(state.api.putCatalogGroups).toHaveBeenCalledTimes(1));
    expect(state.api.putCatalogGroups.mock.calls[0][1]).toEqual({
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
      typeRevision: 3,
      options: [
        { optionKey: 'option-stealth', title: 'Stealth' },
        { optionKey: 'option-lore', title: 'Lore' },
      ],
      isActive: true,
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
    renderCatalog('/groups/12/gm/catalog');
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
    expect(state.api.putCatalogAttributes.mock.calls[0][1]).toEqual({
      expectedRevision: 7,
      definitions: [{
        id: 'attr-tags',
        title: 'Tags',
        typeKey: 'multiChoice',
        options: [{ optionKey: 'option-stealth', title: 'Quiet' }],
        isActive: true,
      }],
    });
  });
});
