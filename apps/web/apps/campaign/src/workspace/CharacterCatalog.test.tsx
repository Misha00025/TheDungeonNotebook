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
  { id: 'note-a', title: 'Заметка A', typeKey: 'string', options: [] },
  { id: 'note-b', title: 'Заметка B', typeKey: 'string', options: [] },
];
const attribute = (id: string, value: string): CatalogAttributeOccurrence => ({ id, attributeId: id, value, editLevel: 'Character' });
const sourceDefinition: CatalogMetadata = {
  id: sourceId,
  campaignId: 12,
  name: 'Тайный паёк',
  kind: 'Item',
  creatorUserId: 9,
  isHidden: true,
  quantityUnit: 'Single',
  allowNegative: false,
  metadataRevision: 2,
};
const rawDefinition = ({ kind: _kind, ...definition }: CatalogMetadata) => definition;
const rawEntry = (entry: CharacterCatalogEntryEnvelope): Omit<CharacterCatalogEntryEnvelope, 'definition'> & { definition: ReturnType<typeof rawDefinition> } => ({ ...entry, definition: rawDefinition(entry.definition) });
const sourceContent = { campaignId: 12, resourceId: sourceId, contentRevision: 4, data: { description: 'Источник определения.', attributes: [] } };

function makeEntry(options: {
  id?: string;
  quantity?: JsonNumber | null;
  metadataRevision?: number;
  localContentRevision?: number;
  attributes?: CatalogAttributeOccurrence[];
  effectiveAttributes?: CatalogAttributeOccurrence[];
  definition?: CatalogMetadata;
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
    definition: options.definition ?? sourceDefinition,
    definitionDescription: 'Личная запись.',
    effectiveAttributes: options.effectiveAttributes ?? attributes,
    explicitAttributes: attributes,
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
    if (url === `/api/campaigns/12/characters/${characterId}/items` && method === 'GET') return response([]);
    if (url === `/api/campaigns/12/items/attributes`) return response({ campaignId: 12, contentRevision: 1, data: { definitions: attributeDefinitions } });
    if (url === '/api/campaigns/12/items/groups') return response({ campaignId: 12, contentRevision: 1, groups: [] });
    if (url === '/api/campaigns/12/items' || url.startsWith('/api/campaigns/12/items?')) return response([rawDefinition(sourceDefinition)]);
    if (url === `/api/campaigns/12/items/${sourceId}`) return response(rawDefinition(sourceDefinition));
    if (url === `/api/campaigns/12/items/${sourceId}/content`) return response(sourceContent);
    if (url.startsWith(`/api/campaigns/12/characters/${characterId}/items/additions/`)) return response({ code: 'not_found', title: 'Not found', detail: 'Not found' }, 404);
    if (url === `/api/campaigns/12/characters/${characterId}/items/${recordId}` && method === 'GET') return response(rawEntry(makeEntry()));
    if (url === `/api/campaigns/12/characters/${characterId}/items/${recordId}` && method === 'DELETE') return new Response(null, { status: 204 });
    if (url.startsWith(`/api/campaigns/12/characters/${characterId}/items`) && method === 'POST') return response({ requestId: 'request', entry: rawEntry(makeEntry()) });
    if (url.startsWith(`/api/campaigns/12/characters/${characterId}/items`) && method === 'PUT') return response(rawEntry(makeEntry()));
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
function catalogTree(request: (url: string, options?: RequestInit) => Promise<Response>, permissions: PermissionProps = {}, kind: CatalogKind = 'Item', panel: Partial<React.ComponentProps<typeof CharacterCatalogPanel>> = {}) {
  return <RemoteAuthProvider auth={auth(request)}>
    <MemoryRouter initialEntries={[`/groups/12/gm/characters/${characterId}/inventory`]}>
      <WorkspaceProvider mountPath="/groups/12">
        <DirtyProvider>
          <CharacterCatalogProvider campaignId={12} characterId={characterId} kind={kind} canRead={permissions.canRead ?? true} canWrite={permissions.canWrite ?? false} permissionsPending={permissions.permissionsPending ?? false}>
             <CharacterCatalogPanel kind={kind} {...panel} />
          </CharacterCatalogProvider>
        </DirtyProvider>
      </WorkspaceProvider>
    </MemoryRouter>
  </RemoteAuthProvider>;
}

async function expandCatalogAndSelect(dialog: HTMLElement, name: string) {
  const expandAll = await within(dialog).findByRole('button', { name: 'Развернуть всё' });
  await waitFor(() => expect(expandAll).toBeEnabled());
  fireEvent.click(expandAll);
  fireEvent.click(await within(dialog).findByRole('button', { name: `Выбрать ${name}` }));
}

describe('character catalog consumer', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

  it('shows an attached hidden definition to a reader without exposing writes or reading source content', async () => {
    const attached = makeEntry({ quantity: 0, attributes: [], effectiveAttributes: [attribute('note-a', 'read-only')], localContentRevision: 0, definition: { ...sourceDefinition, quantityUnit: 'Whole' } });
    const { request, calls } = makeRequest((url, options) => {
      if (url === `/api/campaigns/12/characters/${characterId}/items` && options?.method !== 'POST') return response([rawEntry(attached)]);
      if (url === `/api/campaigns/12/characters/${characterId}/items/${recordId}` && options?.method !== 'DELETE') return response(rawEntry(attached));
      return undefined;
    });
    render(catalogTree(request));

    const recordButton = await screen.findByRole('button', { name: 'Тайный паёк' });
    expect(screen.queryByRole('button', { name: 'Добавить предмет' })).not.toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    fireEvent.click(recordButton);
    const dialog = await screen.findByRole('dialog', { name: 'Тайный паёк' });
    expect(screen.queryByRole('textbox', { name: 'Количество' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Значение: Заметка A' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('0')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Изменить' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Убрать у персонажа' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Изменить: Заметка A' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Сбросить к каталогу: Заметка A' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('combobox', { name: 'Количество' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox', { name: 'Отрицательное' })).not.toBeInTheDocument();
    expect(screen.getAllByText('read-only')[0]).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сохранить изменения' })).not.toBeInTheDocument();
    expect(calls.some(([url]) => url === `/api/campaigns/12/items/${sourceId}` || url === `/api/campaigns/12/items/${sourceId}/content`)).toBe(false);
    expect(calls.some(([, options]) => ['POST', 'PUT', 'DELETE'].includes(options?.method ?? ''))).toBe(false);
  });

  it('resets only the selected explicit occurrence with the local content revision', async () => {
    let current = makeEntry({ attributes: [attribute('note-a', 'remove'), attribute('note-b', 'keep')] });
    const { request, calls } = makeRequest((url, options) => {
      if (url === `/api/campaigns/12/characters/${characterId}/items` && options?.method !== 'POST') return response([rawEntry(current)]);
      if (url === `/api/campaigns/12/characters/${characterId}/items/${recordId}` && options?.method === 'GET') return response(rawEntry(current));
      if (url === `/api/campaigns/12/characters/${characterId}/items/${recordId}/attributes` && options?.method === 'PUT') {
        const body = parseJson(String(options.body)) as any;
        current = { ...current, explicitAttributes: body.attributes, effectiveAttributes: body.attributes, localContentRevision: 8 };
        return response(rawEntry(current));
      }
      return undefined;
    });
    render(catalogTree(request, { canWrite: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Тайный паёк' }));
    const dialog = await screen.findByRole('dialog', { name: 'Тайный паёк' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Изменить' }));
    await screen.findByRole('textbox', { name: 'Значение: Заметка A' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сбросить к каталогу: Заметка A' }));
    expect(within(dialog).getByText(/Сброс ожидает сохранения/)).toBeInTheDocument();
    expect(calls.filter(([url, options]) => url.endsWith('/attributes') && options?.method === 'PUT')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отменить сброс' }));
    expect(within(dialog).getByRole('button', { name: 'Сохранить изменения' })).toBeDisabled();
    expect(await screen.findByRole('textbox', { name: 'Значение: Заметка A' })).toHaveValue('remove');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сбросить к каталогу: Заметка A' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeEnabled());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить изменения' }));

    await waitFor(() => expect(calls.some(([url, options]) => url.endsWith('/attributes') && options?.method === 'PUT')).toBe(true));
    const write = calls.find(([url, options]) => url.endsWith('/attributes') && options?.method === 'PUT');
    expect(parseJson(String(write?.[1]?.body))).toEqual({ expectedRevision: 7, attributes: [attribute('note-b', 'keep')] });
    expect(await screen.findByText('Характеристики сохранены.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox', { name: 'Значение: Заметка B' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Изменить' }));
    expect(await screen.findByRole('textbox', { name: 'Значение: Заметка B' })).toHaveValue('keep');
    expect(within(screen.getByRole('table', { name: 'Инвентарь персонажа' })).getByText('1')).toBeInTheDocument();
    expect(calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(0);
  });

  it('blocks a conflicted Single attribute draft and requires explicit recovery before resaving', async () => {
    let current = makeEntry({ attributes: [attribute('note-a', 'remove'), attribute('note-b', 'keep')] });
    let attributeWrites = 0;
    const { request, calls } = makeRequest((url, options) => {
      if (url === `/api/campaigns/12/characters/${characterId}/items` && options?.method !== 'POST') return response([rawEntry(current)]);
      if (url === `/api/campaigns/12/characters/${characterId}/items/${recordId}` && options?.method === 'GET') return response(rawEntry(current));
      if (url.endsWith('/attributes') && options?.method === 'PUT') {
        attributeWrites += 1;
        if (attributeWrites === 1) {
          current = { ...current, localContentRevision: 8 };
          return response({ code: 'content_revision_conflict', title: 'Conflict', detail: 'Changed' }, 409);
        }
        const body = parseJson(String(options.body)) as any;
        current = { ...current, explicitAttributes: body.attributes, effectiveAttributes: body.attributes, localContentRevision: 9 };
        return response(rawEntry(current));
      }
      return undefined;
    });
    render(catalogTree(request, { canWrite: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Тайный паёк' }));
    const dialog = await screen.findByRole('dialog', { name: 'Тайный паёк' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Изменить' }));
    await screen.findByRole('textbox', { name: 'Значение: Заметка A' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сбросить к каталогу: Заметка A' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    expect(await screen.findByRole('heading', { name: 'Восстановление записи' })).toBeInTheDocument();
    await screen.findByRole('button', { name: 'Сохранить изменения' });
    expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeDisabled();
    expect(calls.filter(([url, options]) => url.endsWith('/quantity') && options?.method === 'PUT')).toHaveLength(0);
    expect(calls.filter(([url, options]) => url.endsWith('/attributes') && options?.method === 'PUT')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Проверить актуальные данные' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Оставить мой черновик' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    await waitFor(() => expect(attributeWrites).toBe(2));
    expect(calls.filter(([url, options]) => url.endsWith('/quantity') && options?.method === 'PUT')).toHaveLength(0);
    const attributeBodies = calls.filter(([url, options]) => url.endsWith('/attributes') && options?.method === 'PUT').map(([, options]) => parseJson(String(options?.body)) as any);
    expect(attributeBodies.map(body => body.expectedRevision)).toEqual([7, 8]);
    expect(attributeBodies[1].attributes).toEqual([attribute('note-b', 'keep')]);
  });

  it('creates an own skill definition as hidden for a non-admin and separates its character attributes', async () => {
    let submitted: any;
    const { request, calls } = makeRequest((url, options) => {
      if (url === `/api/campaigns/12/characters/${characterId}/skills` && options?.method === 'GET') return response([]);
      if (url === '/api/campaigns/12/skills/attributes') return response({ campaignId: 12, contentRevision: 1, data: { definitions: attributeDefinitions } });
      if (url === '/api/campaigns/12/skills/groups') return response({ campaignId: 12, contentRevision: 1, groups: [] });
      if (url === '/api/campaigns/12/skills' || url.startsWith('/api/campaigns/12/skills?')) return response([]);
      if (url.endsWith('/skills/create') && options?.method === 'POST') {
        submitted = parseJson(String(options.body));
        const created = makeEntry({ id: 'created-skill', quantity: null, definition: { ...sourceDefinition, id: 'created-definition', name: 'Моя проверка', kind: 'Skill', quantityUnit: null, isHidden: true } });
        return response({ requestId: submitted.requestId, entry: { ...created, record: { ...created.record, catalogEntryId: 'created-definition' }, definition: { ...created.definition, kind: undefined } } });
      }
      return undefined;
    });
    render(catalogTree(request, { canWrite: true }, 'Skill'));
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить навык' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Создать своё' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Название' }), { target: { value: 'Моя проверка' } });
    const characterAttributes = within((await screen.findByRole('heading', { name: 'Характеристики' })).parentElement!);
    fireEvent.change(characterAttributes.getByLabelText('Новая характеристика'), { target: { value: 'note-a' } });
    fireEvent.click(characterAttributes.getByRole('button', { name: 'Добавить характеристику' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Создать и добавить' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Создать и добавить' }));

    await waitFor(() => expect(calls.some(([url, options]) => url.endsWith('/skills/create') && options?.method === 'POST')).toBe(true));
    expect(submitted.definition).toMatchObject({ name: 'Моя проверка', isHidden: true, attributes: [] });
    expect(submitted.attributes).toHaveLength(1);
    expect(submitted.attributes[0]).toMatchObject({ attributeId: 'note-a', editLevel: 'Character' });
    expect(submitted.definition).not.toHaveProperty('creatorUserId');
    expect(submitted.quantity).toBeNull();
    expect(await screen.findByRole('button', { name: 'Моя проверка' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Добавить навык' })).not.toBeInTheDocument();
  });

  it('adds only an explicitly selected editable source occurrence to the character', async () => {
    const definition = { id: 'shared-type', title: 'Тип', typeKey: 'string' as const, options: [] };
    const fixed = { id: 'fixed-type', attributeId: definition.id, value: 'базовый', editLevel: 'Definition' as const };
    const editable = { id: 'personal-type', attributeId: definition.id, value: 'личный', editLevel: 'Character' as const };
    const source = { ...sourceDefinition, quantityUnit: 'Single' as const };
    const { request, calls } = makeRequest((url, options) => {
      if (url === '/api/campaigns/12/items/attributes') return response({ campaignId: 12, contentRevision: 1, data: { definitions: [definition] } });
      if (url === '/api/campaigns/12/items' || url.startsWith('/api/campaigns/12/items?')) return response([rawDefinition(source)]);
      if (url === `/api/campaigns/12/items/${sourceId}`) return response(rawDefinition(source));
      if (url === `/api/campaigns/12/items/${sourceId}/content`) return response({ ...sourceContent, data: { description: 'Два вхождения.', attributes: [fixed, editable] } });
      if (url === `/api/campaigns/12/characters/${characterId}/items` && options?.method === 'POST') {
        const body = parseJson(String(options.body)) as any;
        return response({ requestId: body.requestId, entry: rawEntry(makeEntry({ id: 'added-record', quantity: 1, attributes: body.attributes })) });
      }
      return undefined;
    });
    render(catalogTree(request, { canWrite: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить предмет' }));
    const dialog = await screen.findByRole('dialog', { name: 'Добавить предмет' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Поиск по названию' }), { target: { value: source.name } });
    fireEvent.click(await within(dialog).findByRole('button', { name: source.name }));
    expect(await within(dialog).findByText('Два вхождения.')).toBeInTheDocument();
    expect(calls.filter(([url, options]) => url === `/api/campaigns/12/characters/${characterId}/items` && options?.method === 'POST')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Выбрать' }));
    expect(await within(dialog).findByLabelText('Количество')).toHaveTextContent('1');
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Изменить: Тип' }));
    const value = await within(dialog).findByRole('textbox', { name: 'Значение: Тип' });
    fireEvent.change(value, { target: { value: 'новый личный тип' } });
    expect(within(dialog).queryByRole('textbox', { name: 'Количество' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить персонажу' }));

    await waitFor(() => expect(calls.some(([url, options]) => url === `/api/campaigns/12/characters/${characterId}/items` && options?.method === 'POST')).toBe(true));
    const post = calls.find(([url, options]) => url === `/api/campaigns/12/characters/${characterId}/items` && options?.method === 'POST');
    expect(parseJson(String(post?.[1]?.body))).toMatchObject({
      catalogEntryId: sourceId,
      quantity: 1,
      attributes: [{ id: 'personal-type', attributeId: 'shared-type', value: 'новый личный тип', editLevel: 'Character' }],
    });
    expect(calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
  });

  it('lets a definition owner edit the catalog from a read-only character entry', async () => {
    let definition = { ...sourceDefinition, creatorUserId: 4 };
    let entry = makeEntry();
    const { request, calls } = makeRequest((url, options) => {
      if (url === `/api/campaigns/12/characters/${characterId}/items` && options?.method !== 'POST') return response([rawEntry(entry)]);
      if (url === `/api/campaigns/12/characters/${characterId}/items/${recordId}` && options?.method === 'GET') return response({ ...entry, definition });
      if (url === `/api/campaigns/12/items/${sourceId}` && options?.method === 'GET') return response(rawDefinition(definition));
      if (url === `/api/campaigns/12/items/${sourceId}/content`) return response(sourceContent);
      if (url === `/api/campaigns/12/items/${sourceId}` && options?.method === 'PUT') {
        const body = parseJson(String(options.body)) as any;
        definition = { ...definition, name: body.name, metadataRevision: 3 };
        entry = { ...entry, definition };
        return response(rawDefinition(definition));
      }
      return undefined;
    });
    render(catalogTree(request, { canWrite: false }, 'Item', { audience: 'player' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Тайный паёк' }));
    const entryDialog = await screen.findByRole('dialog', { name: 'Тайный паёк' });
    expect(within(entryDialog).queryByRole('textbox', { name: 'Название' })).not.toBeInTheDocument();
    fireEvent.click(within(entryDialog).getByRole('button', { name: 'Изменить мой предмет' }));
    await screen.findByRole('textbox', { name: 'Название' });
    const definitionDialogs = await screen.findAllByRole('dialog', { name: 'Тайный паёк' });
    const definitionDialog = definitionDialogs.find(candidate => within(candidate).queryByRole('textbox', { name: 'Название' }))!;
    fireEvent.change(await within(definitionDialog).findByRole('textbox', { name: 'Название' }), { target: { value: 'Обновлённый паёк' } });
    fireEvent.click(within(definitionDialog).getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(calls.some(([url, options]) => url.endsWith(`/items/${sourceId}`) && options?.method === 'PUT')).toBe(true));
    const metadataPut = calls.find(([url, options]) => url.endsWith(`/items/${sourceId}`) && options?.method === 'PUT');
    expect(parseJson(String(metadataPut?.[1]?.body))).toMatchObject({ name: 'Обновлённый паёк', expectedRevision: 2 });
    expect(calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
    expect(calls.some(([url, options]) => url.includes(`/characters/${characterId}/items/`) && options?.method === 'PUT')).toBe(false);
    await waitFor(() => expect(within(definitionDialog).getByText('Закрыть', { selector: 'button' })).toBeEnabled());
    fireEvent.click(within(definitionDialog).getByText('Закрыть', { selector: 'button' }));
    expect(await screen.findByRole('button', { name: 'Обновлённый паёк' })).toBeInTheDocument();
  });

  it('retains an uncertain add operation across permission refresh and confirms it without reposting', async () => {
    let receiptReads = 0;
    let submittedRequestId = '';
    const existing = makeEntry({ id: 'created-record', quantity: 1 });
    const created = makeEntry({ id: 'created-record', quantity: 2 });
    const { request, calls } = makeRequest((url, options) => {
      if (url === `/api/campaigns/12/characters/${characterId}/items` && options?.method === 'GET') return response([existing]);
      if (url === `/api/campaigns/12/characters/${characterId}/items` && options?.method === 'POST') {
        submittedRequestId = String((parseJson(String(options.body)) as any).requestId);
        return response({ code: 'publication_outcome_unknown', title: 'Unavailable', detail: 'Unknown outcome' }, 503);
      }
      if (url.startsWith(`/api/campaigns/12/characters/${characterId}/items/additions/`)) {
        receiptReads += 1;
        if (receiptReads === 1) return response({ code: 'not_found', title: 'Not found', detail: 'Not found' }, 404);
        return response({ campaignId: 12, characterId, requestId: submittedRequestId, entryId: created.record.id, catalogEntryId: sourceId });
      }
      if (url === `/api/campaigns/12/characters/${characterId}/items/${created.record.id}` && options?.method === 'GET') return response(created);
      return undefined;
    });
    const mounted = render(catalogTree(request, { canWrite: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить предмет' }));
    const addDialog = screen.getByRole('dialog', { name: 'Добавить предмет' });
    await expandCatalogAndSelect(addDialog, sourceDefinition.name);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить персонажу' })).toBeEnabled());
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить персонажу' }));
    expect(await screen.findByText('Добавление пока не подтверждено. Проверку можно повторить.')).toBeInTheDocument();

    mounted.rerender(catalogTree(request, { canRead: true, canWrite: false, permissionsPending: true }));
    expect(screen.getByRole('dialog', { name: 'Добавить предмет' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Проверить результат добавления' }));

    expect(await screen.findByRole('button', { name: 'Тайный паёк' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Тайный паёк' })).toHaveLength(1);
    expect(screen.getByRole('cell', { name: '2' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Добавить предмет' })).not.toBeInTheDocument();
    expect(calls.filter(([url, options]) => url === `/api/campaigns/12/characters/${characterId}/items` && options?.method === 'POST')).toHaveLength(1);
    expect(calls.filter(([url]) => url.endsWith(`/additions/${submittedRequestId}`))).toHaveLength(2);
  });

  it.each(['inventory', 'skills'])('opens the GM %s service and switches to the player character root', async service => {
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns') return response([campaign]);
      if (url === '/api/campaigns/12') return response(campaign);
      if (url === '/api/campaigns/12/permissions') return response({ canRead: true, canWrite: true, canManageAccess: true });
      if (url === `/api/campaigns/12/characters/${characterId}`) return response({ id: characterId, campaignId: 12, name: 'Service hero', importance: 'Key', metadataRevision: 1 });
      if (url === `/api/campaigns/12/characters/${characterId}/permissions`) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url === `/api/campaigns/12/characters/${characterId}/${service === 'inventory' ? 'items' : 'skills'}`) return response([]);
      if (url === '/api/campaigns/12/items/attributes') return response({ campaignId: 12, contentRevision: 1, data: { definitions: [] } });
      if (url === '/api/campaigns/12/characters') return response([]);
      if (url === `/api/campaigns/12/characters/${characterId}/computed-sheet`) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [], virtualFields: [], formulaContentRevisions: [] });
      if (url === '/api/campaigns/12/presentation') return response({ contentRevision: 1, defaults: {}, contextParams: {} });
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter initialEntries={[`/groups/12/gm/characters/${characterId}/${service}`]}><Routes><Route path="/groups/*" element={<App auth={auth(request)} />} /></Routes><CurrentPath /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Service hero' })).toBeInTheDocument();
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
    expect(screen.getByLabelText('Current pathname').textContent).toBe(`/groups/12/gm/characters/${characterId}/${service}`);
    expect(request.mock.calls.some(([url]) => url.endsWith('/computed-sheet'))).toBe(true);
    expect(request.mock.calls.some(([url]) => url.endsWith('/presentation'))).toBe(true);
    const characterPermissionRead = request.mock.calls.findIndex(([url]) => url === `/api/campaigns/12/characters/${characterId}/permissions`);
    const entriesRead = request.mock.calls.findIndex(([url]) => url === `/api/campaigns/12/characters/${characterId}/${service === 'inventory' ? 'items' : 'skills'}`);
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
    expect(request.mock.calls.some(([url]) => url.includes('/characters/') && (url.includes('/items') || url.includes('/skills')))).toBe(false);
  });
});
