import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import { LosslessNumber } from 'lossless-json';
import { parseJson, stringifyJson } from './json';
import type { JsonValue } from './types';
import CharacterSheet from './CharacterSheet';
import { DirtyProvider, WorkspaceProvider } from './Workspace';

const characterId = 'abcdef01-2345-6789-abcd-ef0123456789';
const firstId = '11111111-1111-4111-8111-111111111111';
const primaryId = '22222222-2222-4222-8222-222222222222';
const maximumId = '33333333-3333-4333-8333-333333333333';
const response = (body: unknown, status = 200) => new Response(stringifyJson(body), { status, headers: { 'Content-Type': 'application/json' } });
const fields = [
  { id: firstId, key: 'first', title: 'First source secret', description: '', valueType: 'Integer', typeRevision: 1, options: [], effectiveValue: 16, isExplicit: true },
  { id: primaryId, key: 'primary', title: 'Primary source secret', description: '', valueType: 'Integer', typeRevision: 1, options: [], effectiveValue: new LosslessNumber('3'), isExplicit: true },
  { id: maximumId, key: 'maximum', title: 'Maximum source secret', description: '', valueType: 'Integer', typeRevision: 1, options: [], effectiveValue: 20, isExplicit: true },
];
const computedSheet = { contentRevision: 7, templateContentRevision: 2, description: '', baseFields: fields, virtualFields: [], formulaContentRevisions: [] };
const presentation = { contentRevision: 4, defaults: { page_1: 'view-key' }, contextParams: { page_1: { title: 'Страница' } } };
const headerViewKey = '44444444-4444-4444-8444-444444444444';
const roots = [
  { kind: 'layout', nodeKey: 'composite', title: 'Защита', params: { version: 1, type: 'composite', parts: [{ source: { kind: 'Base', fieldId: firstId } }, { text: ' (' }, { source: { kind: 'Base', fieldId: primaryId }, signed: true }, { text: ')' }], primary: { kind: 'Base', fieldId: primaryId } }, children: [] },
  { kind: 'layout', nodeKey: 'resource', title: 'Запас', params: { version: 1, type: 'resource', current: { kind: 'Base', fieldId: primaryId }, maximum: { kind: 'Base', fieldId: maximumId }, showBar: false }, children: [] },
  { kind: 'layout', nodeKey: 'stats', title: 'Статы', params: { version: 1, type: 'stat-list', columns: 1, condition: '$0 > 3', entries: [{ source: { kind: 'Base', fieldId: primaryId }, label: 'Сила' }] }, children: [] },
];
const resolved = { contextKey: 'page_1', viewMetadata: { id: 'view-id', key: 'view-key', campaignId: 12, name: 'View', metadataRevision: 1 }, viewContent: { campaignId: 12, resourceId: 'view-id', contentRevision: 3, data: { roots } }, contextParams: null, contentRevision: 3 };
const auth = (request: (url: string, options?: RequestInit) => Promise<Response>) => ({ status: 'authenticated', authenticated: true, userId: 4, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }) as unknown as HubRemoteProps['auth'];
const renderSheet = (request: (url: string, options?: RequestInit) => Promise<Response>) => render(<MemoryRouter initialEntries={[`/12/player/characters/${characterId}/page_1`]}><RemoteAuthProvider auth={auth(request)}><WorkspaceProvider mountPath="/"><DirtyProvider><CharacterSheet campaignId={12} characterId={characterId} pageKey="page_1" /></DirtyProvider></WorkspaceProvider></RemoteAuthProvider></MemoryRouter>);
const requestFixture = (permission: { canRead: boolean; canWrite: boolean }, put: (url: string, options?: RequestInit) => Promise<Response> = async () => response({ ...computedSheet, contentRevision: 8 }), withHeader = false) => {
  let currentSheet = computedSheet;
  const configuredPresentation = withHeader ? { ...presentation, defaults: { ...presentation.defaults, character_header: headerViewKey } } : presentation;
  const headerResolved = { ...resolved, contextKey: 'character_header', viewMetadata: { ...resolved.viewMetadata, key: headerViewKey } };
  return vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith(`/characters/${characterId}/permissions`)) return response({ ...permission, canManageAccess: false });
    if (url.endsWith(`/characters/${characterId}/computed-sheet`)) return response(currentSheet);
    if (url.endsWith(`/characters/${characterId}`)) return response({ id: characterId, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
    if (url.includes('/presentation/resolve?')) {
      const contextKey = new URL(url, 'http://localhost').searchParams.get('contextKey');
      if (contextKey === 'character_header' && withHeader) return response(headerResolved);
      if (contextKey === 'page_1') return response(resolved);
    }
      if (url.endsWith('/presentation')) return response(configuredPresentation);
      if (options?.method === 'PUT') {
        const result = await put(url, options);
        if (result.ok && url.includes('/base-values/')) {
          const body = parseJson(String(options.body)) as { value: JsonValue };
          const fieldId = url.split('/').at(-1);
          currentSheet = { ...currentSheet, contentRevision: 8, baseFields: currentSheet.baseFields.map(field => field.id === fieldId ? { ...field, effectiveValue: body.value as typeof field.effectiveValue } : field) } as typeof computedSheet;
          return response(currentSheet);
        }
        return result;
    }
    return response([]);
  });
};

describe('CharacterSheet presentation UX', () => {
  it('opens only the clicked primary field in place and writes only that field on outside blur', async () => {
    const request = requestFixture({ canRead: true, canWrite: true });
    renderSheet(request);
    const triggers = await screen.findAllByRole('button', { name: 'Изменить показатель Primary source secret' });
    const record = triggers.find(trigger => trigger.textContent === '16 (+3)')!;
    expect(triggers).toHaveLength(2);
    expect(triggers.some(trigger => trigger.textContent === '20')).toBe(false);
    expect(record).toHaveTextContent('16 (+3)');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('First source secret');
    expect(document.body.textContent).not.toContain('Maximum source secret');
    expect(screen.getByText('/')).toBeInTheDocument();
    fireEvent.click(within(record).getByText('16'));
    const input = await screen.findByRole('textbox', { name: 'Primary source secret' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Изменить показатель Primary source secret' })).toHaveLength(1);
    expect(screen.getAllByRole('textbox', { name: 'Primary source secret' })).toHaveLength(1);
    expect(within(screen.getByRole('article', { name: 'Запас' })).getByRole('button', { name: 'Изменить показатель Primary source secret' })).toHaveTextContent('3');
    expect(input).toHaveValue('3');
    expect(input).not.toHaveValue('16 (+3)');
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    fireEvent.change(input, { target: { value: '9223372036854775807' } });
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(screen.queryByRole('textbox', { name: 'Primary source secret' })).not.toBeInTheDocument();
    await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1));
    const [url, options] = request.mock.calls.find(([, requestOptions]) => requestOptions?.method === 'PUT')!;
    expect(url).toBe(`/api/campaigns/12/characters/${characterId}/base-values/${primaryId}`);
    expect(String(options?.body)).toBe('{"value":9223372036854775807,"expectedRevision":7}');
    expect(url).not.toContain(firstId);
    expect(url).not.toContain(maximumId);
  });

  it('writes only the selected resource maximum', async () => {
    const request = requestFixture({ canRead: true, canWrite: true });
    renderSheet(request);
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить показатель Maximum source secret' }));
    const input = await screen.findByRole('textbox', { name: 'Maximum source secret' });
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.blur(input, { relatedTarget: document.body });
    await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1));
    const [url, options] = request.mock.calls.find(([, requestOptions]) => requestOptions?.method === 'PUT')!;
    expect(url).toBe(`/api/campaigns/12/characters/${characterId}/base-values/${maximumId}`);
    expect(String(options?.body)).toBe('{"value":25,"expectedRevision":7}');
  });

  it('resolves the header by context key and shares one field draft and revision with the page', async () => {
    const request = requestFixture({ canRead: true, canWrite: true }, undefined, true);
    renderSheet(request);
    const header = await screen.findByRole('region', { name: 'Шапка персонажа' });
    const page = await screen.findByRole('region', { name: 'Страница персонажа' });
    await waitFor(() => expect(request.mock.calls.some(([url]) => url.endsWith('/presentation/resolve?contextKey=character_header'))).toBe(true));
    expect(request.mock.calls.some(([url]) => url.endsWith(`/presentation/resolve?contextKey=${headerViewKey}`))).toBe(false);

    fireEvent.click((await within(header).findAllByRole('button', { name: 'Изменить показатель Primary source secret' }))[0]!);
    const input = await within(header).findByRole('textbox', { name: 'Primary source secret' });
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input, { relatedTarget: document.body });

    await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1));
    await waitFor(() => expect(within(page).getAllByRole('button', { name: 'Изменить показатель Primary source secret' }).some(button => button.textContent?.includes('16 (+5)'))).toBe(true));
    const [url, options] = request.mock.calls.find(([, requestOptions]) => requestOptions?.method === 'PUT')!;
    expect(url).toBe(`/api/campaigns/12/characters/${characterId}/base-values/${primaryId}`);
    expect(String(options?.body)).toBe('{"value":5,"expectedRevision":7}');
  });

  it('keeps an invalid raw draft across blur and reopen without writing it', async () => {
    const request = requestFixture({ canRead: true, canWrite: true });
    renderSheet(request);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Изменить показатель Primary source secret' }))[0]!);
    let input = await screen.findByRole('textbox', { name: 'Primary source secret' });
    fireEvent.change(input, { target: { value: '-' } });
    expect(screen.getAllByRole('alert').every(error => error.textContent?.includes('Введите целое число.'))).toBe(true);
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(screen.queryByRole('textbox', { name: 'Primary source secret' })).not.toBeInTheDocument();
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Изменить показатель Primary source secret' })[0]!);
    input = await screen.findByRole('textbox', { name: 'Primary source secret' });
    expect(input).toHaveValue('-');
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
  });

  it('does not expose a presentation trigger in read-only mode and renders resource current/max as one anonymous ratio', async () => {
    const request = requestFixture({ canRead: true, canWrite: false });
    renderSheet(request);
    expect(await screen.findByText('Только чтение')).toBeInTheDocument();
    const composite = await screen.findByRole('article', { name: 'Защита' });
    expect(composite).toHaveTextContent('16 (+3)');
    const resource = screen.getByRole('article', { name: 'Запас' });
    expect(within(resource).getByText('3')).toBeInTheDocument();
    expect(within(resource).getByText('/')).toBeInTheDocument();
    expect(within(resource).getByText('20')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Изменить показатель/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('First source secret');
    expect(document.body.textContent).not.toContain('Primary source secret');
    expect(document.body.textContent).not.toContain('Maximum source secret');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('closes the inline editor while a write is pending and disables further writes', async () => {
    let resolveWrite!: (value: Response) => void;
    const request = requestFixture({ canRead: true, canWrite: true }, () => new Promise(resolve => { resolveWrite = resolve; }));
    renderSheet(request);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Изменить показатель Primary source secret' }))[0]!);
    const input = await screen.findByRole('textbox', { name: 'Primary source secret' });
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.blur(input, { relatedTarget: document.body });
    await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1));
    expect(screen.queryByRole('textbox', { name: 'Primary source secret' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Изменить показатель Primary source secret' }).every(button => (button as HTMLButtonElement).disabled)).toBe(true);
    resolveWrite(response({ ...computedSheet, contentRevision: 8 }));
    await waitFor(() => {
      const triggers = screen.getAllByRole('button', { name: 'Изменить показатель Primary source secret' });
      expect(triggers).toHaveLength(2);
      expect(triggers.every(trigger => (trigger as HTMLButtonElement).disabled === false)).toBe(true);
    });
    expect(screen.getByRole('article', { name: 'Защита' })).toHaveTextContent('16 (+4)');
    expect(screen.getByRole('article', { name: 'Запас' })).toHaveTextContent('4/20');
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
  });

  it('refreshes only computed data after a confirmed field write and retains visible values while that read is pending', async () => {
    let computedReads = 0;
    let resolveComputed!: (value: Response) => void;
    const pendingComputed = new Promise<Response>(resolve => { resolveComputed = resolve; });
    const initial = { ...computedSheet, virtualFields: [{ id: 'virtual-id', key: 'virtual', title: 'Derived score', description: '', resultType: 'Integer', value: 6, diagnostic: null }] };
    const updated = { ...initial, contentRevision: 8, baseFields: fields.map(field => field.id === primaryId ? { ...field, effectiveValue: 4 } : field), virtualFields: [{ ...initial.virtualFields[0], value: 8 }] };
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith(`/characters/${characterId}/permissions`)) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith(`/characters/${characterId}/computed-sheet`)) { computedReads += 1; return computedReads === 1 ? response(initial) : pendingComputed; }
      if (url.endsWith(`/characters/${characterId}`)) return response({ id: characterId, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/presentation')) return response(presentation);
      if (url.endsWith('/presentation/resolve?contextKey=page_1')) return response({ ...resolved, viewContent: { ...resolved.viewContent, data: { roots: [...roots, { kind: 'layout', nodeKey: 'virtual-root', title: 'Derived', params: { version: 1, type: 'stat-list', columns: 1, entries: [{ source: { kind: 'Virtual', fieldId: 'virtual-id' }, label: 'Derived score' }] }, children: [] }] } } });
      if (options?.method === 'PUT' && url.endsWith(`/base-values/${primaryId}`)) return response({ ...computedSheet, contentRevision: 8, baseFields: fields.map(field => field.id === primaryId ? { ...field, effectiveValue: 4 } : field) });
      return response([]);
    });
    renderSheet(request);
    const derived = await screen.findByRole('article', { name: 'Derived' });
    expect(within(derived).getByText('6')).toBeInTheDocument();
    const initialCounts = {
      permissions: request.mock.calls.filter(([url]) => url.endsWith(`/characters/${characterId}/permissions`)).length,
      metadata: request.mock.calls.filter(([url, options]) => url.endsWith(`/characters/${characterId}`) && options?.method !== 'PUT').length,
      presentation: request.mock.calls.filter(([url]) => url.endsWith('/presentation')).length,
      resolve: request.mock.calls.filter(([url]) => url.includes('/presentation/resolve')).length,
      lists: request.mock.calls.filter(([url]) => url === '/api/campaigns/12/characters').length,
    };
    fireEvent.click((await screen.findAllByRole('button', { name: 'Изменить показатель Primary source secret' }))[0]!);
    const input = await screen.findByRole('textbox', { name: 'Primary source secret' });
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.blur(input, { relatedTarget: document.body });
    await waitFor(() => expect(computedReads).toBe(2));
    expect(within(derived).getByText('6')).toBeInTheDocument();
    expect(screen.queryByText('Поле сохранено.')).not.toBeInTheDocument();
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
    expect(request.mock.calls.filter(([url]) => url.endsWith(`/characters/${characterId}/permissions`))).toHaveLength(initialCounts.permissions);
    expect(request.mock.calls.filter(([url, options]) => url.endsWith(`/characters/${characterId}`) && options?.method !== 'PUT')).toHaveLength(initialCounts.metadata);
    expect(request.mock.calls.filter(([url]) => url.endsWith('/presentation'))).toHaveLength(initialCounts.presentation);
    expect(request.mock.calls.filter(([url]) => url.includes('/presentation/resolve'))).toHaveLength(initialCounts.resolve);
    expect(request.mock.calls.filter(([url]) => url === '/api/campaigns/12/characters')).toHaveLength(initialCounts.lists);
    await act(async () => resolveComputed(response(updated)));
    expect(await within(derived).findByText('8')).toBeInTheDocument();
  });

  it('retries only failed computed reads after a confirmed write', async () => {
    let computedReads = 0;
    const initial = { ...computedSheet, virtualFields: [{ id: 'virtual-id', key: 'virtual', title: 'Derived score', description: '', resultType: 'Integer', value: 6, diagnostic: null }] };
    const updated = { ...initial, contentRevision: 8, baseFields: fields.map(field => field.id === primaryId ? { ...field, effectiveValue: 4 } : field), virtualFields: [{ ...initial.virtualFields[0], value: 8 }] };
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith(`/characters/${characterId}/permissions`)) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith(`/characters/${characterId}/computed-sheet`)) { computedReads += 1; return computedReads === 1 ? response(initial) : computedReads === 2 ? response({ code: 'dependency_unavailable', title: 'Unavailable', detail: 'Failed' }, 503) : response(updated); }
      if (url.endsWith(`/characters/${characterId}`)) return response({ id: characterId, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/presentation')) return response(presentation);
      if (url.endsWith('/presentation/resolve?contextKey=page_1')) return response({ ...resolved, viewContent: { ...resolved.viewContent, data: { roots: [...roots, { kind: 'layout', nodeKey: 'virtual-root', title: 'Derived', params: { version: 1, type: 'stat-list', columns: 1, entries: [{ source: { kind: 'Virtual', fieldId: 'virtual-id' }, label: 'Derived score' }] }, children: [] }] } } });
      if (options?.method === 'PUT' && url.endsWith(`/base-values/${primaryId}`)) return response({ ...computedSheet, contentRevision: 8, baseFields: fields.map(field => field.id === primaryId ? { ...field, effectiveValue: 4 } : field) });
      return response([]);
    });
    renderSheet(request);
    const derived = await screen.findByRole('article', { name: 'Derived' });
    expect(within(derived).getByText('6')).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Изменить показатель Primary source secret' }))[0]!);
    const input = await screen.findByRole('textbox', { name: 'Primary source secret' });
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(await screen.findByText('Зависимый сервис временно недоступен.')).toBeInTheDocument();
    expect(within(derived).getByText('6')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Защита' })).toHaveTextContent('16 (+4)');
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
    const before = request.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Повторить обновление расчётов' }));
    expect(await within(derived).findByText('8')).toBeInTheDocument();
    expect(request.mock.calls.length).toBe(before + 1);
    expect(request.mock.calls.at(-1)?.[0]).toBe(`/api/campaigns/12/characters/${characterId}/computed-sheet`);
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
  });

  it('does not write an unchanged value on click and blur and commits a stat-list value through the same pipeline', async () => {
    const request = requestFixture({ canRead: true, canWrite: true });
    renderSheet(request);
    fireEvent.click(await screen.findByText('Остальные характеристики (1)'));
    const statValue = await screen.findByRole('button', { name: 'Изменить показатель Сила' });
    expect(screen.getByText('Сила')).toBeInTheDocument();
    fireEvent.click(statValue);
    const input = await screen.findByRole('textbox', { name: 'Сила' });
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить показатель Сила' }));
    const changed = await screen.findByRole('textbox', { name: 'Сила' });
    fireEvent.change(changed, { target: { value: '5' } });
    fireEvent.keyDown(changed, { key: 'Enter' });
    fireEvent.blur(changed, { relatedTarget: document.body });
    await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText('Остальные характеристики (1)')).not.toBeInTheDocument());
    const [url, options] = request.mock.calls.find(([, requestOptions]) => requestOptions?.method === 'PUT')!;
    expect(url).toContain(`/base-values/${primaryId}`);
    expect(String(options?.body)).toBe('{"value":5,"expectedRevision":7}');
    expect(request.mock.calls.filter(([path, requestOptions]) => requestOptions?.method === 'PUT' && (path.includes('/presentation') || path.includes('/assignments')))).toHaveLength(0);
  });

  it('keeps an unknown field-write outcome blocked without retrying and retains the draft for verification', async () => {
    const request = requestFixture({ canRead: true, canWrite: true }, async () => response({ code: 'write_outcome_unknown', title: 'Unknown', detail: 'Unknown' }, 502));
    renderSheet(request);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Изменить показатель Primary source secret' }))[0]!);
    const input = await screen.findByRole('textbox', { name: 'Primary source secret' });
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.blur(input, { relatedTarget: document.body });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Проверить данные и права' })).toBeInTheDocument());
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Проверить данные и права' }));
    await waitFor(() => expect(request.mock.calls.filter(([url, options]) => url.endsWith(`/characters/${characterId}/computed-sheet`) && options?.method !== 'PUT')).toHaveLength(2));
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Изменить показатель Primary source secret' })[0]).toBeEnabled());
    fireEvent.click(screen.getAllByRole('button', { name: 'Изменить показатель Primary source secret' })[0]!);
    expect(await screen.findByRole('textbox', { name: 'Primary source secret' })).toHaveValue('4');
  });
});
