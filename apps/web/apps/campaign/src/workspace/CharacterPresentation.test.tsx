import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import { stringifyJson } from './json';
import { WorkspaceProvider } from './Workspace';
import CharacterPresentation from './CharacterPresentation';

const response = (body: unknown, status = 200) => new Response(stringifyJson(body), { status, headers: { 'Content-Type': 'application/json' } });
const characterId = 'character-id';
const sheet = { contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [], virtualFields: [], formulaContentRevisions: [] };
const resolved = (pageKey: string, title: string) => ({ contextKey: pageKey, viewMetadata: { id: title, key: title, campaignId: 12, name: title, metadataRevision: 1 }, viewContent: { campaignId: 12, resourceId: title, contentRevision: 1, data: { roots: [{ kind: 'layout', nodeKey: title, title, params: {}, children: [] }] } }, contextParams: null, contentRevision: 1 });
const auth = (request: (url: string, options?: RequestInit) => Promise<Response>) => ({ status: 'authenticated', authenticated: true, userId: 4, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }) as unknown as HubRemoteProps['auth'];
const tree = (request: (url: string, options?: RequestInit) => Promise<Response>, pageKey = 'page_1', refreshKey = 0) => <MemoryRouter><RemoteAuthProvider auth={auth(request)}><WorkspaceProvider mountPath="/"><CharacterPresentation campaignId={12} characterId={characterId} pageKey={pageKey} sheet={sheet} refreshKey={refreshKey} /></WorkspaceProvider></RemoteAuthProvider></MemoryRouter>;

describe('CharacterPresentation', () => {
  it('keeps the current page visible during refresh and recoverable read failure, then updates it on retry', async () => {
    let resolveRefresh!: (value: Response) => void;
    const pending = new Promise<Response>(resolve => { resolveRefresh = resolve; });
    let reads = 0;
    const request = vi.fn(async (url: string) => {
      if (!url.includes('/presentation/resolve?')) return response([]);
      reads += 1;
      if (reads === 1) return response(resolved('page_1', 'Current page'));
      if (reads === 2) return pending;
      if (reads === 3) return response({ code: 'dependency_unavailable', title: 'Unavailable', detail: 'Temporary' }, 503);
      return response(resolved('page_1', 'Updated page'));
    });
    const view = render(tree(request));
    expect(await screen.findByRole('article', { name: 'Current page' })).toBeInTheDocument();
    view.rerender(tree(request, 'page_1', 1));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('article', { name: 'Current page' })).toBeInTheDocument();
    await act(async () => resolveRefresh(response(resolved('page_1', 'Updated page'))));
    expect(await screen.findByRole('article', { name: 'Updated page' })).toBeInTheDocument();
    view.rerender(tree(request, 'page_1', 2));
    expect(await screen.findByText('Зависимый сервис временно недоступен.')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Updated page' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку страницы' }));
    expect(await screen.findByRole('article', { name: 'Updated page' })).toBeInTheDocument();
  });

  it('does not show a previous page while another page is loading and hides it after confirmed denial', async () => {
    let resolveSecond!: (value: Response) => void;
    const second = new Promise<Response>(resolve => { resolveSecond = resolve; });
    const request = vi.fn(async (url: string) => {
      if (!url.includes('/presentation/resolve?')) return response([]);
      const key = new URL(url, 'http://localhost').searchParams.get('contextKey');
      if (key === 'page_1') return response(resolved('page_1', 'First page'));
      return second;
    });
    const view = render(tree(request));
    expect(await screen.findByRole('article', { name: 'First page' })).toBeInTheDocument();
    view.rerender(tree(request, 'page_2'));
    expect(screen.queryByRole('article', { name: 'First page' })).not.toBeInTheDocument();
    await act(async () => resolveSecond(response({ code: 'forbidden', title: 'Forbidden', detail: 'Denied' }, 403)));
    expect(await screen.findByText('Доступ запрещён.')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'First page' })).not.toBeInTheDocument();
  });
});
