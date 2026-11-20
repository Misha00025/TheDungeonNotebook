import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import { stringifyJson } from './json';
import CharacterSheet from './CharacterSheet';
import { DirtyProvider, WorkspaceProvider } from './Workspace';

const firstId = 'abcdef01-2345-6789-abcd-ef0123456789';
const secondId = 'abcdef01-2345-6789-abcd-ef0123456790';
const response = (body: unknown, status = 200) => new Response(stringifyJson(body), { status, headers: { 'Content-Type': 'application/json' } });
const field = { id: 'field-id', key: 'might', title: 'Might', description: '', valueType: 'Integer', typeRevision: 1, options: [], effectiveValue: 3, isExplicit: true };
const sheet = { contentRevision: 5, templateContentRevision: 1, description: 'Initial description', baseFields: [field], virtualFields: [], formulaContentRevisions: [] };
const metadata = (id: string, name: string, metadataRevision = 10) => ({ id, campaignId: 12, name, importance: 'Key', metadataRevision });
const presentation = { contentRevision: 1, defaults: { page_1: 'view-id' }, contextParams: { page_1: { title: 'Page' } } };
const resolved = { contextKey: 'page_1', viewMetadata: { id: 'view-id', key: 'view-id', campaignId: 12, name: 'View', metadataRevision: 1 }, viewContent: { campaignId: 12, resourceId: 'view-id', contentRevision: 1, data: { roots: [{ kind: 'layout', nodeKey: 'stats', title: 'Stats', params: { version: 1, type: 'stat-list', columns: 1, entries: [{ source: { kind: 'Base', fieldId: field.id }, label: 'Might' }] }, children: [] }] } }, contextParams: null, contentRevision: 1 };
const auth = (request: (url: string, options?: RequestInit) => Promise<Response>, userId: number) => ({ status: 'authenticated', authenticated: true, userId, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request: async (url: string, options?: RequestInit) => {
  const result = await request(url, options);
  if (result.ok && url.endsWith('/presentation')) {
    const body = await result.clone().json().catch(() => undefined);
    if (Array.isArray(body) && body.length === 0) return response(presentation);
  }
  if (result.ok && url.includes('/presentation/resolve?')) {
    const body = await result.clone().json().catch(() => undefined);
    if (Array.isArray(body) && body.length === 0) return response(resolved);
  }
  return result;
}, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }) as unknown as HubRemoteProps['auth'];
const tree = (request: (url: string, options?: RequestInit) => Promise<Response>, characterId = firstId, userId = 4) => <MemoryRouter initialEntries={[`/12/player/characters/${characterId}/page_1`]}><RemoteAuthProvider auth={auth(request, userId)}><WorkspaceProvider mountPath="/"><DirtyProvider><CharacterSheet key={`${userId}:${characterId}`} campaignId={12} characterId={characterId} pageKey="page_1" /></DirtyProvider></WorkspaceProvider></RemoteAuthProvider></MemoryRouter>;

describe('CharacterSheet', () => {
  it('saves metadata and description explicitly with independent revisions and no follow-up section reads', async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      calls.push([url, options]);
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${firstId}`) && options?.method === 'PUT') return response(metadata(firstId, 'Renamed', 11));
      if (url.endsWith(`/characters/${firstId}`)) return response(metadata(firstId, 'Hero'));
      if (url.endsWith(`/characters/${firstId}/description`) && options?.method === 'PUT') return response({ contentRevision: 6 });
      if (url.endsWith('/presentation')) return response(presentation);
      if (url.includes('/presentation/resolve?')) return response(resolved);
      return response([]);
    });
    render(tree(request));
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить сведения персонажа' }));
    const name = screen.getByLabelText('Имя');
    fireEvent.change(name, { target: { value: 'Renamed' } });
    fireEvent.blur(name);
    expect(request.mock.calls.filter(([url, options]) => url.endsWith(`/characters/${firstId}`) && options?.method === 'PUT')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить сведения персонажа' }));
    await screen.findByRole('heading', { name: 'Renamed' });
    expect(JSON.parse(String(request.mock.calls.find(([url, options]) => url.endsWith(`/characters/${firstId}`) && options?.method === 'PUT')?.[1]?.body))).toEqual({ name: 'Renamed', importance: 'Key', expectedRevision: 10 });
    fireEvent.click(screen.getByRole('button', { name: 'Изменить описание' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Описание' }), { target: { value: 'Updated description' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить описание' }));
    await waitFor(() => expect(request.mock.calls.filter(([url, options]) => url.endsWith(`/characters/${firstId}/description`) && options?.method === 'PUT')).toHaveLength(1));
    expect(JSON.parse(String(request.mock.calls.find(([url, options]) => url.endsWith(`/characters/${firstId}/description`) && options?.method === 'PUT')?.[1]?.body))).toEqual({ description: 'Updated description', expectedRevision: 5 });
    expect(calls.filter(([url, options]) => url.endsWith(`/characters/${firstId}`) && options?.method !== 'PUT')).toHaveLength(1);
    expect(calls.filter(([url]) => url.endsWith('/computed-sheet'))).toHaveLength(1);
    expect(calls.filter(([url]) => url.endsWith('/presentation') || url.includes('/presentation/resolve?'))).toHaveLength(2);
  });

  it('refreshes own permissions after a forbidden field write while retaining the disabled draft', async () => {
    let permissionReads = 0;
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) { permissionReads += 1; return response({ canRead: true, canWrite: permissionReads === 1, canManageAccess: false }); }
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${firstId}`)) return response(metadata(firstId, 'Hero'));
      if (url.endsWith('/presentation')) return response(presentation);
      if (url.includes('/presentation/resolve?')) return response(resolved);
      if (url.endsWith('/base-values/field-id') && options?.method === 'PUT') return response({ code: 'forbidden', title: 'Forbidden', detail: 'Denied' }, 403);
      return response([]);
    });
    render(tree(request));
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить показатель Might' }));
    const input = await screen.findByRole('textbox', { name: 'Might' });
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(await screen.findByText('Доступ запрещён.')).toBeInTheDocument();
    await waitFor(() => expect(permissionReads).toBe(2));
    expect(screen.queryByRole('button', { name: 'Изменить показатель Might' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Неподтверждённые значения' })).toBeInTheDocument();
    expect(screen.getByText('Локальный ввод сохранён, но сейчас нет подтверждённого права записи.')).toBeInTheDocument();
    expect(request.mock.calls.filter(([url]) => url.endsWith('/computed-sheet'))).toHaveLength(1);
    expect(request.mock.calls.filter(([url, options]) => url.endsWith(`/characters/${firstId}`) && options?.method !== 'PUT')).toHaveLength(1);
    expect(request.mock.calls.filter(([url]) => url.endsWith('/presentation') || url.includes('/presentation/resolve?'))).toHaveLength(2);
  });

  it('keeps a conflicted field draft blocked until explicit recovery and never retries its write automatically', async () => {
    let writes = 0;
    let computedReads = 0;
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) { computedReads += 1; return response(sheet); }
      if (url.endsWith(`/characters/${firstId}`)) return response(metadata(firstId, 'Hero'));
      if (url.endsWith('/presentation')) return response(presentation);
      if (url.includes('/presentation/resolve?')) return response(resolved);
      if (url.endsWith('/base-values/field-id') && options?.method === 'PUT') { writes += 1; return response({ code: 'conflict', title: 'Conflict', detail: 'Changed' }, 409); }
      return response([]);
    });
    render(tree(request));
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить показатель Might' }));
    const input = await screen.findByRole('textbox', { name: 'Might' });
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(await screen.findByRole('button', { name: 'Проверить данные и права' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Изменить показатель Might' })).toHaveTextContent('8');
    expect(writes).toBe(1);
    expect(computedReads).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Проверить данные и права' }));
    await waitFor(() => expect(computedReads).toBe(2));
    expect(screen.getByRole('button', { name: 'Изменить показатель Might' })).toHaveTextContent('8');
    expect(writes).toBe(1);
  });

  it('does not let a late request from an old account and character replace the active sheet', async () => {
    let resolveOld!: (value: Response) => void;
    const oldSheet = new Promise<Response>(resolve => { resolveOld = resolve; });
    const oldRequest = vi.fn(async (url: string) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return oldSheet;
      if (url.endsWith(`/characters/${firstId}`)) return response(metadata(firstId, 'Old account'));
      return response([]);
    });
    const newRequest = vi.fn(async (url: string) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response({ ...sheet, baseFields: [{ ...field, effectiveValue: 12 }] });
      if (url.endsWith(`/characters/${secondId}`)) return response(metadata(secondId, 'New account'));
      return response([]);
    });
    const rendered = render(tree(oldRequest));
    await waitFor(() => expect(oldRequest.mock.calls.some(([url]) => url.endsWith('/computed-sheet'))).toBe(true));
    rendered.rerender(tree(newRequest, secondId, 5));
    expect(await screen.findByRole('heading', { name: 'New account' })).toBeInTheDocument();
    expect(await screen.findByText('12')).toBeInTheDocument();
    await act(async () => resolveOld(response(sheet)));
    expect(screen.getByRole('heading', { name: 'New account' })).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Old account' })).not.toBeInTheDocument();
  });
});
