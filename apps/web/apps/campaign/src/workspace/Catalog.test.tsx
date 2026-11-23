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
import type { CatalogContentEnvelope, CatalogGroup, CatalogGroupConfigurationEnvelope, CatalogGroupInput, CatalogMetadata } from './catalogTypes';

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

function changeFocusedGroupTitle(value: string) {
  const input = screen.getAllByRole('textbox', { name: 'Название группы' }).find(element => element === document.activeElement);
  if (!input) throw new Error('A newly added group title input is not focused.');
  fireEvent.change(input, { target: { value } });
}

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

describe('catalog definition recovery and group editing', () => {
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
      attributeSchemaRevision: 4,
      diagnostics: [],
    });
    state.api.getCatalogAttributes.mockResolvedValue({
      campaignId: 12,
      contentRevision: 4,
      data: { definitions: [{ id: 'attribute-power', title: 'Power', typeKey: 'integer', typeRevision: 4, options: [], isActive: true }] },
    });
    state.api.putCatalogGroups.mockResolvedValue({
      campaignId: 12,
      contentRevision: 12,
      data: { groups: [firstGroup, secondGroup] },
      attributeSchemaRevision: 4,
      diagnostics: [],
    });
    renderGroupsDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Группы каталога' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Состав: First group' }));
    const cancelledMembers = await screen.findByRole('dialog', { name: 'Состав: First group' });
    fireEvent.click(within(cancelledMembers).getByRole('checkbox', { name: 'Включить Second tonic в группу' }));
    fireEvent.click(within(cancelledMembers).getByRole('checkbox', { name: 'Убрать недоступное определение 1 из группы' }));
    fireEvent.click(within(cancelledMembers).getByRole('button', { name: 'Отмена' }));
    expect(state.api.putCatalogGroups).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Состав: First group' }));
    const members = await screen.findByRole('dialog', { name: 'Состав: First group' });
    expect(within(members).getByRole('checkbox', { name: 'Включить Hidden tonic в группу' })).toBeChecked();
    expect(within(members).getByRole('checkbox', { name: 'Убрать недоступное определение 1 из группы' })).toBeChecked();
    expect(within(members).getByRole('checkbox', { name: 'Включить Second tonic в группу' })).not.toBeChecked();
    fireEvent.change(within(members).getByRole('textbox', { name: 'Поиск определений' }), { target: { value: 'Second' } });
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
    const submitted = state.api.putCatalogGroups.mock.calls[0][1];
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
      '{"operator":"eq","attributeId":"attribute-power","typeKey":"integer","typeRevision":4,"value":7}',
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
      attributeSchemaRevision: 0,
      diagnostics: [],
    });
    state.api.listCatalog.mockResolvedValue([metadata]);
    state.api.putCatalogGroups.mockResolvedValue({
      campaignId: 12,
      contentRevision: 4,
      data: { groups: [{ ...child, parentId: null }] },
      attributeSchemaRevision: 0,
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
    expect(state.api.putCatalogGroups.mock.calls[0][1]).toEqual({
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
    state.api.getCatalogGroupConfiguration.mockResolvedValue({ campaignId: 12, contentRevision: revision, data: { groups: confirmedGroups }, attributeSchemaRevision: 0, diagnostics: [] });
    state.api.listCatalog.mockResolvedValue([]);
    state.api.getCatalogAttributes.mockResolvedValue({ campaignId: 12, contentRevision: 0, data: { definitions: [] } });
    state.api.putCatalogGroups.mockImplementation(async (_campaignId: number, body: GroupPutBody) => {
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
      const result: CatalogGroupConfigurationEnvelope = { campaignId: 12, contentRevision: revision, data: { groups: confirmedGroups }, attributeSchemaRevision: 0, diagnostics: [] };
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

    const firstStage = state.api.putCatalogGroups.mock.calls[0][1] as GroupPutBody;
    expect(firstStage).toEqual({
      expectedRevision: 8,
      groups: [
        { id: root.id, title: root.title, parentId: null, entryIds: [], condition: null },
        { id: other.id, title: other.title, parentId: null, entryIds: [], condition: null },
        { title: 'Child', parentId: root.id, entryIds: [], condition: null },
      ],
    });
    const finalStage = state.api.putCatalogGroups.mock.calls[1][1] as GroupPutBody;
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
    state.api.getCatalogGroupConfiguration.mockResolvedValue({ campaignId: 12, contentRevision: revision, data: { groups: confirmedGroups }, attributeSchemaRevision: 0, diagnostics: [] });
    state.api.listCatalog.mockResolvedValue([]);
    state.api.getCatalogAttributes.mockResolvedValue({ campaignId: 12, contentRevision: 0, data: { definitions: [] } });
    state.api.putCatalogGroups
      .mockImplementationOnce(async (_campaignId: number, body: GroupPutBody) => {
        const priorIds = new Set(confirmedGroups.map(group => group.id));
        const assigned: CatalogGroup[] = body.groups.map((group): CatalogGroup => {
          if (group.id && !priorIds.has(group.id)) throw new Error('A new group ID was supplied to the server.');
          return { ...group, id: group.id ?? 'server-child' };
        });
        const assignedIds = new Set(assigned.map(group => group.id));
        if (assigned.some(group => group.parentId && !assignedIds.has(group.parentId))) throw new Error('A parent was not included in the request.');
        confirmedGroups = assigned;
        revision += 1;
        const result = { campaignId: 12, contentRevision: revision, data: { groups: confirmedGroups }, attributeSchemaRevision: 0, diagnostics: [] };
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
    expect(state.api.putCatalogGroups.mock.calls[0][1]).toEqual({
      expectedRevision: 30,
      groups: [
        { id: root.id, title: root.title, parentId: null, entryIds: [], condition: null },
        { title: 'Child', parentId: root.id, entryIds: [], condition: null },
      ],
    });
    expect(state.api.putCatalogGroups.mock.calls[1][1]).toEqual({
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
