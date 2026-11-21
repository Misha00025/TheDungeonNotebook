import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import { parseJson, stringifyJson } from './json';
import Views from './Views';
import { DirtyProvider, WorkspaceProvider } from './Workspace';

vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ permissions: { canRead: true, canWrite: true, canManageAccess: false }, permissionsLoading: false }) }));
vi.mock('./ViewEditor', async () => {
  const ReactModule = await import('react');
  const workspace = await import('./Workspace');
  const Editor = ({ viewId, initialSurface }: { viewId: string; initialSurface?: 'page' | 'header' | 'card' }) => {
    const [value, setValue] = ReactModule.useState('');
    workspace.useDirtyDraft(`ux-view-${viewId}`, Boolean(value));
    return <><label>Mock editor {viewId}<input aria-label={`Mock editor ${viewId}`} value={value} onChange={event => setValue(event.target.value)} /></label><span>Initial surface: {initialSurface ?? 'server'}</span></>;
  };
  return { default: Editor };
});

const response = (body: unknown, status = 200) => new Response(stringifyJson(body), { status, headers: { 'Content-Type': 'application/json' } });
const viewA = { id: '11111111-1111-4111-8111-111111111111', key: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', campaignId: 4, name: 'View A', metadataRevision: 1 };
const viewB = { id: '22222222-2222-4222-8222-222222222222', key: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', campaignId: 4, name: 'View B', metadataRevision: 1 };
const initialPresentation = { contentRevision: 5, defaults: { page_1: viewA.key, 'future/context': viewB.key }, contextParams: { page_1: { title: 'Page One', order: 1 }, 'future/context': { preserved: 'yes' } } };
const auth = (request: (url: string, options?: RequestInit) => Promise<Response>) => ({ status: 'authenticated', authenticated: true, userId: 4, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }) as unknown as HubRemoteProps['auth'];
const tree = (request: (url: string, options?: RequestInit) => Promise<Response>) => <MemoryRouter initialEntries={['/4/gm/views']}><RemoteAuthProvider auth={auth(request)}><WorkspaceProvider mountPath="/"><DirtyProvider><Routes><Route path=":groupId/gm/views" element={<Views />} /></Routes></DirtyProvider></WorkspaceProvider></RemoteAuthProvider></MemoryRouter>;
const makeRequest = (onPut: (url: string, options?: RequestInit) => Promise<Response> = async () => response({ ...initialPresentation, contentRevision: 6 })) => vi.fn(async (url: string, options?: RequestInit) => {
  if (url === '/api/campaigns/4/views') return response([viewA, viewB]);
  if (url === '/api/campaigns/4/presentation' && options?.method === 'PUT') return onPut(url, options);
  if (url === '/api/campaigns/4/presentation') return response(initialPresentation);
  return response([]);
});
const selectView = async (id: string) => fireEvent.change(await screen.findByLabelText('Сохранённое отображение'), { target: { value: id } });
const openPages = async () => fireEvent.click(await screen.findByRole('button', { name: 'Назначение' }));

describe('Views workspace UX contracts', () => {
  it('shows named options without a card catalog and changes exactly one editor with dirty confirmation', async () => {
    const request = makeRequest();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(tree(request));
    const select = await screen.findByLabelText('Сохранённое отображение');
    expect(within(select).getByRole('option', { name: 'View A' })).toHaveValue(viewA.id);
    expect(within(select).getByRole('option', { name: 'View B' })).toHaveValue(viewB.id);
    expect(screen.queryByRole('button', { name: 'Открыть отображение' })).not.toBeInTheDocument();
    expect(screen.queryByText('Область назначения: кампания.')).not.toBeInTheDocument();
    await selectView(viewA.id);
    const editorA = await screen.findByLabelText(`Mock editor ${viewA.id}`);
    fireEvent.change(editorA, { target: { value: 'dirty A' } });
    await selectView(viewB.id);
    expect(confirm).toHaveBeenCalledWith('Есть несохранённые изменения. Переключить раздел?');
    expect(screen.getByLabelText(`Mock editor ${viewA.id}`)).toHaveValue('dirty A');
    expect(screen.queryByLabelText(`Mock editor ${viewB.id}`)).not.toBeInTheDocument();
    confirm.mockReturnValue(true);
    await selectView(viewB.id);
    expect(await screen.findByLabelText(`Mock editor ${viewB.id}`)).toBeInTheDocument();
    expect(screen.queryByLabelText(`Mock editor ${viewA.id}`)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Mock editor/)).toHaveLength(1);
    confirm.mockRestore();
  });

  it('omits the ordinary refresh button and does not reload the list on focus or visibility changes', async () => {
    const request = makeRequest();
    render(tree(request));
    await screen.findByLabelText('Сохранённое отображение');
    expect(screen.queryByRole('button', { name: 'Обновить список' })).not.toBeInTheDocument();
    expect(request.mock.calls.filter(([url]) => url === '/api/campaigns/4/views')).toHaveLength(1);
    fireEvent(window, new Event('focus'));
    fireEvent(document, new Event('visibilitychange'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(request.mock.calls.filter(([url]) => url === '/api/campaigns/4/views')).toHaveLength(1);
  });

  it('keeps the selected editor mounted across pages modal and scopes close confirmation to page drafts', async () => {
    const request = makeRequest();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(tree(request));
    await selectView(viewA.id);
    const editor = await screen.findByLabelText(`Mock editor ${viewA.id}`);
    fireEvent.change(editor, { target: { value: 'underlying draft' } });
    await openPages();
    const dialog = await screen.findByRole('dialog', { name: 'Назначение' });
    expect(within(dialog).getAllByRole('heading', { name: 'Назначение' })).toHaveLength(1);
    expect(screen.getByLabelText(`Mock editor ${viewA.id}`)).toHaveValue('underlying draft');
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog', { name: 'Назначение' })).not.toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByLabelText(`Mock editor ${viewA.id}`)).toHaveValue('underlying draft');
    confirm.mockRestore();
  });

  it('retains dirty page inputs when close is rejected and discards only that draft when confirmed', async () => {
    const request = makeRequest();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(tree(request));
    await openPages();
    let dialog = await screen.findByRole('dialog', { name: 'Назначение' });
    const title = within(dialog).getByLabelText('Название страницы');
    fireEvent.change(title, { target: { value: 'Changed page' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    expect(confirm).toHaveBeenCalledWith('Отменить несохранённые назначения?');
    expect(screen.getByRole('dialog', { name: 'Назначение' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Название страницы')).toHaveValue('Changed page');
    confirm.mockReturnValue(true);
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Назначение' })).not.toBeInTheDocument();
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    confirm.mockRestore();
  });

  it('saves exact presentation fields, blocks dismissal while saving, then closes cleanly without a prompt', async () => {
    let resolvePut!: (value: Response) => void;
    const request = makeRequest(() => new Promise(resolve => { resolvePut = resolve; }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(tree(request));
    await openPages();
    const dialog = await screen.findByRole('dialog', { name: 'Назначение' });
    fireEvent.change(within(dialog).getByLabelText('Название страницы'), { target: { value: 'Saved page' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить назначения' }));
    await waitFor(() => expect(request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true));
    expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeDisabled();
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    resolvePut(response({ ...initialPresentation, contentRevision: 6, contextParams: { ...initialPresentation.contextParams, page_1: { ...initialPresentation.contextParams.page_1, title: 'Saved page' } } }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeEnabled());
    const put = request.mock.calls.find(([url, options]) => url === '/api/campaigns/4/presentation' && options?.method === 'PUT');
    expect(parseJson(String(put?.[1]?.body))).toEqual({
      expectedRevision: 5,
      defaults: { page_1: viewA.key, 'future/context': viewB.key },
      contextParams: { page_1: { title: 'Saved page', order: 1 }, 'future/context': { preserved: 'yes' } },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog', { name: 'Назначение' })).not.toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('saves header, card, and page assignments together while preserving view descriptors and unrelated contexts', async () => {
    const assigned = {
      contentRevision: 23,
      defaults: { page_1: viewA.key, character_header: 'old-header', character_card: 'old-card', 'future/context': viewB.key },
      contextParams: {
        page_1: { title: 'Original page', order: 1, pageExtra: false },
        'future/context': { preserved: 'yes' },
        [`view_${viewA.key}`]: { editorSurface: 'page', opaque: false },
        unrelated: [false, 'keep'],
      },
    };
    const updated = {
      ...assigned,
      contentRevision: 24,
      defaults: { ...assigned.defaults, character_header: viewB.key, character_card: viewA.key },
      contextParams: { ...assigned.contextParams, page_1: { title: 'Updated page', order: 1, pageExtra: false } },
    };
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/campaigns/4/views') return response([viewA, viewB]);
      if (url === '/api/campaigns/4/presentation' && options?.method === 'PUT') return response(updated);
      if (url === '/api/campaigns/4/presentation') return response(assigned);
      return response([]);
    });
    render(tree(request));
    await openPages();
    const dialog = await screen.findByRole('dialog', { name: 'Назначение' });
    fireEvent.change(within(dialog).getByLabelText('Название страницы'), { target: { value: 'Updated page' } });
    fireEvent.change(within(dialog).getByLabelText('Шапка персонажа'), { target: { value: viewB.key } });
    fireEvent.change(within(dialog).getByLabelText('Карточка персонажа'), { target: { value: viewA.key } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить назначения' }));

    await waitFor(() => expect(request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true));
    const put = request.mock.calls.find(([url, options]) => url === '/api/campaigns/4/presentation' && options?.method === 'PUT');
    expect(parseJson(String(put?.[1]?.body))).toEqual({
      expectedRevision: 23,
      defaults: { page_1: viewA.key, character_header: viewB.key, character_card: viewA.key, 'future/context': viewB.key },
      contextParams: {
        page_1: { title: 'Updated page', order: 1, pageExtra: false },
        'future/context': { preserved: 'yes' },
        [`view_${viewA.key}`]: { editorSurface: 'page', opaque: false },
        unrelated: [false, 'keep'],
      },
    });
  });

  it('passes the create-time surface to the editor without adding it to create or presentation writes', async () => {
    const created = { id: '33333333-3333-4333-8333-333333333333', key: 'cccccccccccccccccccccccccccccccc', campaignId: 4, name: 'New view', metadataRevision: 1, contentRevision: 1 };
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/campaigns/4/views' && options?.method === 'POST') return response(created);
      if (url === '/api/campaigns/4/views') return response([viewA, viewB]);
      if (url === '/api/campaigns/4/presentation') return response(initialPresentation);
      return response([]);
    });
    render(tree(request));
    fireEvent.click(await screen.findByRole('button', { name: 'Создать отображение' }));
    const dialog = await screen.findByRole('dialog', { name: 'Создать отображение' });
    fireEvent.change(within(dialog).getByLabelText('Название'), { target: { value: 'New view' } });
    fireEvent.change(within(dialog).getByLabelText('Назначение'), { target: { value: 'card' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));

    expect(await screen.findByText('Initial surface: card')).toBeInTheDocument();
    const create = request.mock.calls.find(([url, options]) => url === '/api/campaigns/4/views' && options?.method === 'POST');
    expect(parseJson(String(create?.[1]?.body))).toEqual({ requestId: expect.any(String), name: 'New view', roots: [] });
    expect(request.mock.calls.some(([url, options]) => url === '/api/campaigns/4/presentation' && options?.method === 'PUT')).toBe(false);
  });

  it('allows closing the pages modal during initial GET and ignores its late response', async () => {
    let resolveGet!: (value: Response) => void;
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns/4/views') return response([viewA, viewB]);
      if (url === '/api/campaigns/4/presentation') return new Promise<Response>(resolve => { resolveGet = resolve; });
      return response([]);
    });
    render(tree(request));
    await openPages();
    const dialog = await screen.findByRole('dialog', { name: 'Назначение' });
    expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog', { name: 'Назначение' })).not.toBeInTheDocument();
    resolveGet(response(initialPresentation));
    await waitFor(() => expect(request.mock.calls.filter(([url]) => url === '/api/campaigns/4/presentation')).toHaveLength(1));
    expect(screen.queryByRole('dialog', { name: 'Назначение' })).not.toBeInTheDocument();
  });

  it('blocks modal dismissal during uncertain-save verification', async () => {
    let resolveVerify!: (value: Response) => void;
    let presentationReads = 0;
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/campaigns/4/views') return response([viewA, viewB]);
      if (url === '/api/campaigns/4/presentation' && options?.method === 'PUT') return response({ code: 'write_outcome_unknown', title: 'Unknown', detail: 'Unknown' }, 502);
      if (url === '/api/campaigns/4/presentation') {
        presentationReads += 1;
        if (presentationReads === 1) return response(initialPresentation);
        return new Promise<Response>(resolve => { resolveVerify = resolve; });
      }
      return response([]);
    });
    render(tree(request));
    await openPages();
    const dialog = await screen.findByRole('dialog', { name: 'Назначение' });
    fireEvent.change(within(dialog).getByLabelText('Название страницы'), { target: { value: 'Attempted page' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить назначения' }));
    await within(dialog).findByRole('button', { name: 'Проверить сохранение' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Проверить сохранение' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeDisabled());
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Назначение' })).toBeInTheDocument();
    resolveVerify(response({ ...initialPresentation, contextParams: { ...initialPresentation.contextParams, page_1: { ...initialPresentation.contextParams.page_1, title: 'Attempted page' } } }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeEnabled());
  });
});
