import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { CharacterCatalogProvider } from './CharacterCatalogContext';
import CharacterCatalogPanel from './CharacterCatalogPanel';
import { stringifyJson, parseJson } from './json';
import { DirtyProvider, WorkspaceProvider } from './Workspace';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence, CatalogKind, CatalogMetadata, CharacterCatalogEntryEnvelope } from './catalogTypes';
import type { JsonNumber } from './types';

const characterId = 'abcdef01-2345-6789-abcd-ef0123456789';
const sourceId = 'hidden-source-definition';
const recordId = 'character-record';
const attributeDefinitions: CatalogAttributeDefinition[] = [
  { id: 'note-a', title: 'Заметка A', typeKey: 'string', typeRevision: 1, options: [], isActive: true },
  { id: 'note-b', title: 'Заметка B', typeKey: 'string', typeRevision: 1, options: [], isActive: true },
];
const attribute = (id: string, value: string): CatalogAttributeOccurrence => ({ id, attributeId: id, typeKey: 'string', typeRevision: 1, value, editLevel: 'Character' });
const sourceDefinition: CatalogMetadata = {
  id: sourceId,
  campaignId: 12,
  name: 'Тайный паёк',
  kind: 'Item',
  creatorUserId: 9,
  isHidden: true,
  quantityUnit: 'Whole',
  allowNegative: false,
  metadataRevision: 2,
};
const sourceContent = { campaignId: 12, resourceId: sourceId, contentRevision: 4, attributeSchemaRevision: 1, data: { description: 'Источник определения.', attributes: [] }, diagnostics: [] };

function makeEntry(options: {
  id?: string;
  quantity?: JsonNumber | null;
  metadataRevision?: number;
  localContentRevision?: number;
  attributes?: CatalogAttributeOccurrence[];
} = {}): CharacterCatalogEntryEnvelope {
  const attributes = options.attributes ?? [];
  return {
    record: {
      id: options.id ?? recordId,
      campaignId: 12,
      characterId,
      catalogEntryId: sourceId,
      quantity: options.quantity === undefined ? 1 : options.quantity,
      metadataRevision: options.metadataRevision ?? 5,
    },
    definition: sourceDefinition,
    definitionDescription: 'Личная запись.',
    effectiveAttributes: attributes,
    explicitAttributes: attributes,
    diagnostics: [],
    schemaRevision: 1,
    definitionContentRevision: 4,
    localContentRevision: options.localContentRevision ?? 7,
  };
}

const response = (body: unknown, status = 200) => new Response(stringifyJson(body), { status, headers: { 'Content-Type': 'application/json' } });
const campaign = { id: 12, name: 'Campaign 12', metadataRevision: 1 };
const CurrentPath: React.FC = () => <output aria-label="Current pathname">{useLocation().pathname}</output>;
type RequestHandler = (url: string, options?: RequestInit) => Response | undefined | Promise<Response | undefined>;

function makeRequest(handler?: RequestHandler) {
  const calls: Array<[string, RequestInit | undefined]> = [];
  const request = vi.fn(async (url: string, options?: RequestInit) => {
    calls.push([url, options]);
    const custom = await handler?.(url, options);
    if (custom) return custom;
    const method = options?.method ?? 'GET';
    if (url === `/api/campaigns/12/characters/${characterId}/entries` && method === 'GET') return response([]);
    if (url === `/api/campaigns/12/catalog/attributes`) return response({ campaignId: 12, contentRevision: 1, data: { definitions: attributeDefinitions } });
    if (url === '/api/campaigns/12/catalog/groups') return response({ campaignId: 12, contentRevision: 1, groups: [] });
    if (url === '/api/campaigns/12/catalog' || url.startsWith('/api/campaigns/12/catalog?')) return response([sourceDefinition]);
    if (url === `/api/campaigns/12/catalog/${sourceId}`) return response(sourceDefinition);
    if (url === `/api/campaigns/12/catalog/${sourceId}/content`) return response(sourceContent);
    if (url.startsWith(`/api/campaigns/12/characters/${characterId}/entries/additions/`)) return response({ code: 'not_found', title: 'Not found', detail: 'Not found' }, 404);
    if (url === `/api/campaigns/12/characters/${characterId}/entries/${recordId}` && method === 'GET') return response(makeEntry());
    if (url === `/api/campaigns/12/characters/${characterId}/entries/${recordId}` && method === 'DELETE') return new Response(null, { status: 204 });
    if (url.startsWith(`/api/campaigns/12/characters/${characterId}/entries`) && method === 'POST') return response({ requestId: 'request', entry: makeEntry() });
    if (url.startsWith(`/api/campaigns/12/characters/${characterId}/entries`) && method === 'PUT') return response(makeEntry());
    return response({ code: 'not_found', title: 'Not found', detail: `Unexpected request: ${url}` }, 404);
  });
  return { request, calls };
}

const auth = (request: (url: string, options?: RequestInit) => Promise<Response>) => ({
  status: 'authenticated',
  authenticated: true,
  userId: 4,
  error: null,
  config: { BFF_BASE: '/bff', API_BASE: '/bff/api' },
  request,
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
}) as unknown as HubRemoteProps['auth'];

type PermissionProps = { canRead?: boolean; canWrite?: boolean; permissionsPending?: boolean };
function catalogTree(request: (url: string, options?: RequestInit) => Promise<Response>, permissions: PermissionProps = {}, kind: CatalogKind = 'Item') {
  return <RemoteAuthProvider auth={auth(request)}>
    <MemoryRouter initialEntries={[`/groups/12/gm/characters/${characterId}/inventory`]}>
      <WorkspaceProvider mountPath="/groups/12">
        <DirtyProvider>
          <CharacterCatalogProvider campaignId={12} characterId={characterId} canRead={permissions.canRead ?? true} canWrite={permissions.canWrite ?? false} permissionsPending={permissions.permissionsPending ?? false}>
            <CharacterCatalogPanel kind={kind} />
          </CharacterCatalogProvider>
        </DirtyProvider>
      </WorkspaceProvider>
    </MemoryRouter>
  </RemoteAuthProvider>;
}

describe('character catalog consumer', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

  it('shows an attached hidden definition to a reader without exposing writes or reading source content', async () => {
    const attached = makeEntry({ quantity: 0 });
    const { request, calls } = makeRequest((url, options) => {
      if (url === `/api/campaigns/12/characters/${characterId}/entries` && options?.method !== 'POST') return response([attached]);
      if (url === `/api/campaigns/12/characters/${characterId}/entries/${recordId}` && options?.method !== 'DELETE') return response(attached);
      return undefined;
    });
    render(catalogTree(request));

    const recordButton = await screen.findByRole('button', { name: 'Тайный паёк' });
    expect(screen.queryByRole('button', { name: 'Добавить предмет' })).not.toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    fireEvent.click(recordButton);
    expect(await screen.findByRole('dialog', { name: 'Тайный паёк' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Количество' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сохранить изменения' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Удалить личную запись' })).not.toBeInTheDocument();
    expect(calls.some(([url]) => url === `/api/campaigns/12/catalog/${sourceId}/content`)).toBe(false);
    expect(calls.some(([, options]) => ['POST', 'PUT', 'DELETE'].includes(options?.method ?? ''))).toBe(false);
  });

  it('resets only the selected explicit occurrence with the local content revision', async () => {
    let current = makeEntry({ quantity: 0, attributes: [attribute('note-a', 'remove'), attribute('note-b', 'keep')] });
    const { request, calls } = makeRequest((url, options) => {
      if (url === `/api/campaigns/12/characters/${characterId}/entries` && options?.method !== 'POST') return response([current]);
      if (url === `/api/campaigns/12/characters/${characterId}/entries/${recordId}` && options?.method === 'GET') return response(current);
      if (url === `/api/campaigns/12/characters/${characterId}/entries/${recordId}/attributes` && options?.method === 'PUT') {
        const body = parseJson(String(options.body)) as any;
        current = { ...current, explicitAttributes: body.attributes, effectiveAttributes: body.attributes, localContentRevision: 8 };
        return response(current);
      }
      return undefined;
    });
    render(catalogTree(request, { canWrite: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Тайный паёк' }));
    const row = await screen.findByRole('group', { name: /Заметка A/ });
    fireEvent.click(within(row).getByRole('button', { name: 'Сбросить к каталогу' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));

    await waitFor(() => expect(calls.some(([url, options]) => url.endsWith('/attributes') && options?.method === 'PUT')).toBe(true));
    const write = calls.find(([url, options]) => url.endsWith('/attributes') && options?.method === 'PUT');
    expect(parseJson(String(write?.[1]?.body))).toEqual({ expectedRevision: 7, attributes: [attribute('note-b', 'keep')] });
    expect(screen.getByRole('group', { name: /Заметка B/ })).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Инвентарь персонажа' })).getByText('0')).toBeInTheDocument();
    expect(calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(0);
  });

  it('keeps a partial quantity success, blocks the conflicted attributes, and requires explicit recovery before resaving', async () => {
    let current = makeEntry({ attributes: [attribute('note-a', 'remove'), attribute('note-b', 'keep')] });
    let attributeWrites = 0;
    const { request, calls } = makeRequest((url, options) => {
      if (url === `/api/campaigns/12/characters/${characterId}/entries` && options?.method !== 'POST') return response([current]);
      if (url === `/api/campaigns/12/characters/${characterId}/entries/${recordId}` && options?.method === 'GET') return response(current);
      if (url.endsWith('/quantity') && options?.method === 'PUT') {
        current = { ...current, record: { ...current.record, quantity: 2, metadataRevision: 6 } };
        return response(current);
      }
      if (url.endsWith('/attributes') && options?.method === 'PUT') {
        attributeWrites += 1;
        if (attributeWrites === 1) {
          current = { ...current, localContentRevision: 8 };
          return response({ code: 'content_revision_conflict', title: 'Conflict', detail: 'Changed' }, 409);
        }
        const body = parseJson(String(options.body)) as any;
        current = { ...current, explicitAttributes: body.attributes, effectiveAttributes: body.attributes, localContentRevision: 9 };
        return response(current);
      }
      return undefined;
    });
    render(catalogTree(request, { canWrite: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Тайный паёк' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Количество' }), { target: { value: '2' } });
    fireEvent.click(within(await screen.findByRole('group', { name: /Заметка A/ })).getByRole('button', { name: 'Сбросить к каталогу' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    expect(await screen.findByRole('heading', { name: 'Восстановление записи' })).toBeInTheDocument();
    await screen.findByRole('button', { name: 'Сохранить изменения' });
    expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeDisabled();
    expect(calls.filter(([url, options]) => url.endsWith('/quantity') && options?.method === 'PUT')).toHaveLength(1);
    expect(calls.filter(([url, options]) => url.endsWith('/attributes') && options?.method === 'PUT')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Перечитать серверные данные' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Оставить мой черновик' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    await waitFor(() => expect(attributeWrites).toBe(2));
    expect(calls.filter(([url, options]) => url.endsWith('/quantity') && options?.method === 'PUT')).toHaveLength(1);
    const attributeBodies = calls.filter(([url, options]) => url.endsWith('/attributes') && options?.method === 'PUT').map(([, options]) => parseJson(String(options?.body)) as any);
    expect(attributeBodies.map(body => body.expectedRevision)).toEqual([7, 8]);
    expect(attributeBodies[1].attributes).toEqual([attribute('note-b', 'keep')]);
  });

  it('creates an own skill definition as hidden for a non-admin and separates its character attributes', async () => {
    let submitted: any;
    const { request, calls } = makeRequest((url, options) => {
      if (url === `/api/campaigns/12/characters/${characterId}/entries` && options?.method === 'GET') return response([]);
      if (url.endsWith('/entries/create') && options?.method === 'POST') {
        submitted = parseJson(String(options.body));
        const created = makeEntry({ id: 'created-skill', quantity: null });
        return response({ requestId: submitted.requestId, entry: { ...created, record: { ...created.record, catalogEntryId: 'created-definition' }, definition: { ...sourceDefinition, id: 'created-definition', name: 'Моя проверка', kind: 'Skill', quantityUnit: null, isHidden: true } } });
      }
      return undefined;
    });
    render(catalogTree(request, { canWrite: true }, 'Skill'));
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить навык' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Создать своё' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Название' }), { target: { value: 'Моя проверка' } });
    const characterAttributes = within((await screen.findByRole('heading', { name: 'Собственные атрибуты записи' })).parentElement!);
    fireEvent.change(characterAttributes.getByLabelText('Новый атрибут'), { target: { value: 'note-a' } });
    fireEvent.click(characterAttributes.getByRole('button', { name: 'Добавить атрибут' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Создать и добавить' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Создать и добавить' }));

    await waitFor(() => expect(calls.some(([url, options]) => url.endsWith('/entries/create') && options?.method === 'POST')).toBe(true));
    expect(submitted.definition).toMatchObject({ name: 'Моя проверка', kind: 'Skill', isHidden: true, attributes: [] });
    expect(submitted.definition).not.toHaveProperty('creatorUserId');
    expect(submitted.attributes).toHaveLength(1);
    expect(submitted.attributes[0]).toMatchObject({ attributeId: 'note-a', editLevel: 'Character' });
    expect(submitted.quantity).toBeNull();
    expect(await screen.findByRole('button', { name: 'Моя проверка' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Добавить навык' })).not.toBeInTheDocument();
  });

  it('retains an uncertain add operation across permission refresh and confirms it without reposting', async () => {
    let receiptReads = 0;
    let submittedRequestId = '';
    const existing = makeEntry({ id: 'created-record', quantity: 1 });
    const created = makeEntry({ id: 'created-record', quantity: 2 });
    const { request, calls } = makeRequest((url, options) => {
      if (url === `/api/campaigns/12/characters/${characterId}/entries` && options?.method === 'GET') return response([existing]);
      if (url === `/api/campaigns/12/characters/${characterId}/entries` && options?.method === 'POST') {
        submittedRequestId = String((parseJson(String(options.body)) as any).requestId);
        return response({ code: 'publication_outcome_unknown', title: 'Unavailable', detail: 'Unknown outcome' }, 503);
      }
      if (url.startsWith(`/api/campaigns/12/characters/${characterId}/entries/additions/`)) {
        receiptReads += 1;
        if (receiptReads === 1) return response({ code: 'not_found', title: 'Not found', detail: 'Not found' }, 404);
        return response({ campaignId: 12, characterId, requestId: submittedRequestId, entryId: created.record.id, catalogEntryId: sourceId });
      }
      if (url === `/api/campaigns/12/characters/${characterId}/entries/${created.record.id}` && options?.method === 'GET') return response(created);
      return undefined;
    });
    const mounted = render(catalogTree(request, { canWrite: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить предмет' }));
    const addDialog = screen.getByRole('dialog', { name: 'Добавить предмет' });
    fireEvent.click(await within(addDialog).findByRole('button', { name: sourceDefinition.name }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить запись' })).toBeEnabled());
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить запись' }));
    expect(await screen.findByText('Подтверждение пока не найдено. Повторная проверка выполнит только чтения.')).toBeInTheDocument();

    mounted.rerender(catalogTree(request, { canRead: true, canWrite: false, permissionsPending: true }));
    expect(screen.getByRole('dialog', { name: 'Добавить предмет' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Проверить результат добавления' }));

    expect(await screen.findByRole('button', { name: 'Тайный паёк' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Тайный паёк' })).toHaveLength(1);
    expect(screen.getByRole('cell', { name: '2' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Добавить предмет' })).not.toBeInTheDocument();
    expect(calls.filter(([url, options]) => url === `/api/campaigns/12/characters/${characterId}/entries` && options?.method === 'POST')).toHaveLength(1);
    expect(calls.filter(([url]) => url.endsWith(`/additions/${submittedRequestId}`))).toHaveLength(2);
  });

  it.each(['inventory', 'skills'])('opens the GM %s service without presentation reads and switches to the player character root', async service => {
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns') return response([campaign]);
      if (url === '/api/campaigns/12') return response(campaign);
      if (url === '/api/campaigns/12/permissions') return response({ canRead: true, canWrite: true, canManageAccess: true });
      if (url === `/api/campaigns/12/characters/${characterId}`) return response({ id: characterId, campaignId: 12, name: 'Service hero', importance: 'Key', metadataRevision: 1 });
      if (url === `/api/campaigns/12/characters/${characterId}/permissions`) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url === `/api/campaigns/12/characters/${characterId}/entries`) return response([]);
      if (url === '/api/campaigns/12/catalog/attributes') return response({ campaignId: 12, contentRevision: 1, data: { definitions: [] } });
      if (url === '/api/campaigns/12/characters') return response([]);
      if (url === `/api/campaigns/12/characters/${characterId}/computed-sheet`) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [], virtualFields: [], formulaContentRevisions: [] });
      if (url === '/api/campaigns/12/presentation') return response({ contentRevision: 1, defaults: {}, contextParams: {} });
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter initialEntries={[`/groups/12/gm/characters/${characterId}/${service}`]}><Routes><Route path="/groups/*" element={<App auth={auth(request)} />} /></Routes><CurrentPath /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Service hero' })).toBeInTheDocument();
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
    expect(screen.getByLabelText('Current pathname').textContent).toBe(`/groups/12/gm/characters/${characterId}/${service}`);
    expect(request.mock.calls.some(([url]) => url.includes('/computed-sheet') || url.endsWith('/presentation') || url.includes('/presentation/resolve?'))).toBe(false);
    const characterPermissionRead = request.mock.calls.findIndex(([url]) => url === `/api/campaigns/12/characters/${characterId}/permissions`);
    const entriesRead = request.mock.calls.findIndex(([url]) => url === `/api/campaigns/12/characters/${characterId}/entries`);
    expect(entriesRead).toBeGreaterThan(characterPermissionRead);

    fireEvent.change(screen.getByRole('combobox', { name: 'Окружение' }), { target: { value: 'player' } });
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe(`/groups/12/player/characters/${characterId}`));
    expect(await screen.findByRole('heading', { name: 'Страницы кампании' })).toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url.endsWith('/computed-sheet'))).toBe(true);
    expect(request.mock.calls.some(([url]) => url.endsWith('/presentation'))).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Страница не найдена' })).not.toBeInTheDocument();
  });

  it('rejects player utility routes without reading character catalog entries', async () => {
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns') return response([campaign]);
      if (url === '/api/campaigns/12') return response(campaign);
      if (url === '/api/campaigns/12/permissions') return response({ canRead: true, canWrite: false, canManageAccess: false });
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter initialEntries={[`/groups/12/player/characters/${characterId}/inventory`]}><Routes><Route path="/groups/*" element={<App auth={auth(request)} />} /></Routes><CurrentPath /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url.includes('/characters/') && url.includes('/entries'))).toBe(false);
  });
});
