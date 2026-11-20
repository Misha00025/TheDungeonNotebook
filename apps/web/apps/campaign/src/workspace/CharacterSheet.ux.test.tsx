import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import { LosslessNumber } from 'lossless-json';
import { stringifyJson } from './json';
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
const roots = [
  { kind: 'layout', nodeKey: 'composite', title: 'Защита', params: { version: 1, type: 'composite', parts: [{ source: { kind: 'Base', fieldId: firstId } }, { text: ' (' }, { source: { kind: 'Base', fieldId: primaryId }, signed: true }, { text: ')' }], primary: { kind: 'Base', fieldId: primaryId } }, children: [] },
  { kind: 'layout', nodeKey: 'resource', title: 'Запас', params: { version: 1, type: 'resource', current: { kind: 'Base', fieldId: primaryId }, maximum: { kind: 'Base', fieldId: maximumId }, showBar: false }, children: [] },
];
const resolved = { contextKey: 'page_1', viewMetadata: { id: 'view-id', key: 'view-key', campaignId: 12, name: 'View', metadataRevision: 1 }, viewContent: { campaignId: 12, resourceId: 'view-id', contentRevision: 3, data: { roots } }, contextParams: null, contentRevision: 3 };
const auth = (request: (url: string, options?: RequestInit) => Promise<Response>) => ({ status: 'authenticated', authenticated: true, userId: 4, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }) as unknown as HubRemoteProps['auth'];
const renderSheet = (request: (url: string, options?: RequestInit) => Promise<Response>) => render(<MemoryRouter initialEntries={[`/12/player/characters/${characterId}/page_1`]}><RemoteAuthProvider auth={auth(request)}><WorkspaceProvider mountPath="/"><DirtyProvider><CharacterSheet campaignId={12} characterId={characterId} pageKey="page_1" /></DirtyProvider></WorkspaceProvider></RemoteAuthProvider></MemoryRouter>);
const requestFixture = (permission: { canRead: boolean; canWrite: boolean }, put: (url: string, options?: RequestInit) => Promise<Response> = async () => response({ ...computedSheet, contentRevision: 8 })) => vi.fn(async (url: string, options?: RequestInit) => {
  if (url.endsWith(`/characters/${characterId}/permissions`)) return response({ ...permission, canManageAccess: false });
  if (url.endsWith(`/characters/${characterId}/computed-sheet`)) return response(computedSheet);
  if (url.endsWith(`/characters/${characterId}`)) return response({ id: characterId, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
  if (url.endsWith('/presentation/resolve?contextKey=page_1')) return response(resolved);
  if (url.endsWith('/presentation')) return response(presentation);
  if (options?.method === 'PUT') return put(url, options);
  return response([]);
});

describe('CharacterSheet presentation UX', () => {
  it('opens the selected primary field only after clicking anywhere on the whole record and writes only that field on explicit save', async () => {
    const request = requestFixture({ canRead: true, canWrite: true });
    renderSheet(request);
    const triggers = await screen.findAllByRole('button', { name: 'Изменить показатель Primary source secret' });
    const record = triggers.find(trigger => trigger.textContent === '16 (+3)')!;
    expect(triggers).toHaveLength(2);
    expect(triggers.some(trigger => trigger.textContent === '20')).toBe(false);
    expect(record).toHaveTextContent('16 (+3)');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('First source secret');
    expect(document.body.textContent).not.toContain('Maximum source secret');
    expect(screen.getByText('/')).toBeInTheDocument();
    fireEvent.click(within(record).getByText('16'));
    const dialog = await screen.findByRole('dialog', { name: 'Изменить значение' });
    const input = within(dialog).getByRole('textbox', { name: 'Primary source secret' });
    expect(input).toHaveValue('3');
    expect(input).not.toHaveValue('16 (+3)');
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    fireEvent.change(input, { target: { value: '9223372036854775807' } });
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить значение Primary source secret' }));
    await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1));
    const [url, options] = request.mock.calls.find(([, requestOptions]) => requestOptions?.method === 'PUT')!;
    expect(url).toBe(`/api/campaigns/12/characters/${characterId}/base-values/${primaryId}`);
    expect(String(options?.body)).toBe('{"value":9223372036854775807,"expectedRevision":7}');
    expect(url).not.toContain(firstId);
    expect(url).not.toContain(maximumId);
  });

  it('keeps an invalid raw draft across modal close and reopen without writing it', async () => {
    const request = requestFixture({ canRead: true, canWrite: true });
    renderSheet(request);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Изменить показатель Primary source secret' }))[0]!);
    let dialog = await screen.findByRole('dialog', { name: 'Изменить значение' });
    let input = within(dialog).getByRole('textbox', { name: 'Primary source secret' });
    fireEvent.change(input, { target: { value: '-' } });
    const errors = within(dialog).getAllByRole('alert');
    expect(errors.length).toBeGreaterThan(0);
    errors.forEach(error => expect(error).toHaveTextContent('Введите целое число.'));
    expect(within(dialog).getByRole('button', { name: 'Сохранить значение Primary source secret' })).toBeDisabled();
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog', { name: 'Изменить значение' })).not.toBeInTheDocument();
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Изменить показатель Primary source secret' })[0]!);
    dialog = await screen.findByRole('dialog', { name: 'Изменить значение' });
    input = within(dialog).getByRole('textbox', { name: 'Primary source secret' });
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
    expect(screen.queryByRole('dialog', { name: 'Изменить значение' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('First source secret');
    expect(document.body.textContent).not.toContain('Primary source secret');
    expect(document.body.textContent).not.toContain('Maximum source secret');
  });

  it('blocks modal dismissal while the explicit field write is pending', async () => {
    let resolveWrite!: (value: Response) => void;
    const request = requestFixture({ canRead: true, canWrite: true }, () => new Promise(resolve => { resolveWrite = resolve; }));
    renderSheet(request);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Изменить показатель Primary source secret' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Изменить значение' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Primary source secret' }), { target: { value: '4' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить значение Primary source secret' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeDisabled());
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Изменить значение' })).toBeInTheDocument();
    resolveWrite(response({ ...computedSheet, contentRevision: 8 }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeEnabled());
  });
});
