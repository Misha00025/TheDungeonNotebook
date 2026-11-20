import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import { stringifyJson } from './json';
import { WorkspaceProvider } from './Workspace';
import CharacterPresentation from './CharacterPresentation';

const response = (body: unknown, status = 200) => new Response(stringifyJson(body), { status, headers: { 'Content-Type': 'application/json' } });
const auth = (request: (url: string, options?: RequestInit) => Promise<Response>) => ({ status: 'authenticated', authenticated: true, userId: 4, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }) as unknown as HubRemoteProps['auth'];
const config = (defaults: Record<string, string>) => ({ contentRevision: 0, defaults, contextParams: {} });
const computedSheet = { contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [{ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', key: 'field', title: 'Field', description: '', valueType: 'String' as const, typeRevision: 1, options: [], effectiveValue: 'value', isExplicit: true }], virtualFields: [], formulaContentRevisions: [] };
const view = (viewId = 'view-id', revision = 4, nodeKey = 'node') => ({ contextKey: 'character.overview', viewMetadata: { id: viewId, key: viewId, campaignId: 12, name: 'Hero view', metadataRevision: 1 }, viewContent: { campaignId: 12, resourceId: viewId, contentRevision: revision, data: { roots: [{ kind: 'widget', nodeKey, title: 'Displayed', params: {}, children: [], sources: [], format: '$1' }] } }, contextParams: null, contentRevision: revision });
const sources = (revision = 4, value: string | number = 'Hero') => ({ viewContentRevision: revision, contentRevision: 3, templateContentRevision: 2, formulaContentRevisions: [], widgets: [{ nodeKey: 'node', sources: [{ sourceIndex: 0, source: { kind: 'Base', fieldId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }, value, diagnostic: null }] }] });
const tree = (request: (url: string, options?: RequestInit) => Promise<Response>, characterId = 'character-id', refreshKey = 0) => <MemoryRouter><RemoteAuthProvider auth={auth(request)}><WorkspaceProvider mountPath="/"><CharacterPresentation campaignId={12} characterId={characterId} pageKey="page_1" sheet={computedSheet} refreshKey={refreshKey} /></WorkspaceProvider></RemoteAuthProvider></MemoryRouter>;

describe('CharacterPresentation', () => {
  it('does not resolve or load sources when presentation defaults are empty', async () => {
    const request = vi.fn(async (url: string) => url.endsWith('/presentation') ? response(config({})) : response([]));
    render(tree(request));
    expect(await screen.findByText('Представление не назначено.')).toBeInTheDocument();
    expect(request.mock.calls.filter(([url]) => url.endsWith('/presentation/resolve') || url.endsWith('/sources'))).toHaveLength(0);
  });

  it('resolves only configured contexts using the encoded key and loads read-only source values', async () => {
    const ctx = 'character.overview + extra';
    const encodedContext = new URLSearchParams({ contextKey: ctx }).toString();
    const request = vi.fn(async (url: string) => {
      if (url.endsWith('/presentation')) return response(config({ 'character.overview': 'default-view', [ctx]: 'view-id' }));
      if (url.includes('/presentation/resolve?')) return response(new URL(url, 'http://localhost').searchParams.get('contextKey') === ctx ? view() : view('default-view'));
      if (url.endsWith('/views/view-id/sources?characterId=character-id')) return response(sources(4, 'Selected context'));
      if (url.endsWith('/sources?characterId=character-id')) return response(sources(4, 'Default context'));
      return response({ code: 'unexpected', title: 'Unexpected', detail: url }, 500);
    });
    render(tree(request));
    fireEvent.change(await screen.findByLabelText('Представление'), { target: { value: ctx } });
    await waitFor(() => expect(request.mock.calls.some(([url]) => url.includes('/presentation/resolve?') && new URL(url, 'http://localhost').searchParams.get('contextKey') === ctx)).toBe(true));
    await waitFor(() => expect(request.mock.calls.some(([url]) => url.endsWith('/views/view-id/sources?characterId=character-id'))).toBe(true));
    expect(await screen.findByText('Selected context')).toBeInTheDocument();
    expect(screen.queryByText('Default context')).not.toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url.includes(`/presentation/resolve?${encodedContext}`))).toBe(true);
    expect(request.mock.calls.map(([url]) => url).some(url => /\/templates|\/formulas|\/content/.test(url))).toBe(false);
  });

  it('treats only view_not_configured as unassigned and reports forbidden resolution errors', async () => {
    const makeRequest = (code: string, status: number) => vi.fn(async (url: string) => url.endsWith('/presentation') ? response(config({ 'character.overview': 'view-id' })) : url.includes('/presentation/resolve?') ? response({ code, title: 'Failure', detail: 'Resolution failed' }, status) : response([]));
    const unassigned = render(tree(makeRequest('view_not_configured', 404)));
    expect(await screen.findByText('Представление не назначено.')).toBeInTheDocument();
    unassigned.unmount();
    render(tree(makeRequest('forbidden', 403)));
    expect(await screen.findByText('Доступ запрещён.')).toBeInTheDocument();
    expect(screen.queryByText('Представление не назначено.')).not.toBeInTheDocument();
  });

  it('does not render mixed view/source revisions and requires explicit refresh', async () => {
    const request = vi.fn(async (url: string) => url.endsWith('/presentation') ? response(config({ 'character.overview': 'view-id' })) : url.includes('/presentation/resolve?') ? response(view()) : url.endsWith('/sources?characterId=character-id') ? response(sources(5, 0)) : response([]));
    render(tree(request));
    expect(await screen.findByText('Представление изменилось; обновите данные')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Обновить данные представления' })).toBeInTheDocument();
  });

  it('ignores an old character source request after the character changes', async () => {
    let resolveOld!: (value: Response) => void;
    const oldSources = new Promise<Response>(resolve => { resolveOld = resolve; });
    const request = vi.fn(async (url: string) => {
      if (url.endsWith('/presentation')) return response(config({ 'character.overview': 'view-id' }));
      if (url.includes('/presentation/resolve?')) return response(view());
      if (url.endsWith('/sources?characterId=old-character')) return oldSources;
      if (url.endsWith('/sources?characterId=new-character')) return response(sources(4, 'New character'));
      return response([]);
    });
    const rendered = render(tree(request, 'old-character'));
    await waitFor(() => expect(request.mock.calls.some(([url]) => url.endsWith('/sources?characterId=old-character'))).toBe(true));
    rendered.rerender(tree(request, 'new-character'));
    expect(await screen.findByText('New character')).toBeInTheDocument();
    resolveOld(response(sources(4, 'Stale character')));
    await waitFor(() => expect(screen.queryByText('Stale character')).not.toBeInTheDocument());
    expect(screen.getByText('New character')).toBeInTheDocument();
  });
});
