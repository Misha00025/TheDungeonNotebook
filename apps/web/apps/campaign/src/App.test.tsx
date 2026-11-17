import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import Home from './Home';
import type { HubRemoteProps } from '@tdn/shared';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const makeAuth = (request: (url: string, options?: RequestInit) => Promise<Response>, userId = 4) => ({ status: 'authenticated', authenticated: true, userId, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }) as unknown as HubRemoteProps['auth'];
const campaign = (id = 12) => ({ id, name: `Campaign ${id}`, metadataRevision: 1 });
const permissions = (canWrite = true) => ({ canRead: true, canWrite, canManageAccess: false });
const renderApp = (initial: string, request: (url: string, options?: RequestInit) => Promise<Response>) => render(<MemoryRouter initialEntries={[initial]}><App auth={makeAuth(request)} /></MemoryRouter>);

describe('campaign first iteration', () => {
  it('creates with one stable request id and routes to the returned campaign', async () => {
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/campaigns' && options?.method === 'POST') return response(campaign(21), 201);
      if (url === '/api/campaigns/21/permissions') return response(permissions());
      if (url === '/api/campaigns/21') return response(campaign(21));
      return response([]);
    });
    renderApp('/', request);
    fireEvent.click(await screen.findByRole('button', { name: 'Создать кампанию' }));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'New campaign' } });
    fireEvent.click(screen.getByRole('button', { name: /^Создать$/ }));
    expect(await screen.findByRole('heading', { name: 'Обзор кампании' })).toBeInTheDocument();
    const posts = request.mock.calls.filter(([url, options]) => url === '/api/campaigns' && options?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual({ name: 'New campaign', requestId: expect.any(String) });
    expect(request.mock.calls.some(([url]) => url === '/api/campaigns/21')).toBe(true);
  });

  it('rechecks an unknown create result with the same UUID and never reposts', async () => {
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/campaigns' && options?.method === 'POST') throw new Error('connection lost');
      if (url.startsWith('/api/campaigns/creation/')) return response({ code: 'not_found', title: 'Not found', detail: 'Not found' }, 404);
      return response([]);
    });
    renderApp('/', request);
    fireEvent.click(await screen.findByRole('button', { name: 'Создать кампанию' }));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Uncertain' } });
    fireEvent.click(screen.getByRole('button', { name: /^Создать$/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Проверить создание' }));
    await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1));
    const posts = request.mock.calls.filter(([url, options]) => url === '/api/campaigns' && options?.method === 'POST');
    const requestId = JSON.parse(String(posts[0][1]?.body)).requestId;
    expect(request.mock.calls.filter(([url]) => url === `/api/campaigns/creation/${requestId}`)).toHaveLength(2);
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual({ name: 'Uncertain', requestId });
  });

  it('shows supported destinations and safely rejects future routes', async () => {
    const unsupported = ['/12/gm/formulas', '/12/gm/views', '/12/quests', '/12/items', ...['items', 'skills', 'quests', 'notes'].map(tab => `/12/character/abcdef01-2345-6789-abcd-ef0123456789/${tab}`)];
    for (const path of unsupported) {
      const request = vi.fn(async (url: string) => url.endsWith('/permissions') ? response(permissions()) : url === '/api/campaigns/12' ? response(campaign()) : response([]));
      const view = renderApp(path, request);
      expect(await screen.findByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'К кампаниям' })).toBeInTheDocument();
      expect(request.mock.calls.map(([url]) => url).some(url => /templates|members|assignments|formulas|views|sheet|quests|items/.test(url))).toBe(false);
      view.unmount();
    }
    const request = vi.fn(async (url: string) => url.endsWith('/permissions') ? response(permissions()) : url === '/api/campaigns/12' ? response(campaign()) : url.endsWith('/characters') ? response([]) : response([]));
    renderApp('/12/gm/overview', request);
    expect(await screen.findByRole('heading', { name: 'Обзор кампании' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Обзор' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Персонажи' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Шаблоны' })).toBeInTheDocument();
    for (const label of ['Формулы', 'Представления', 'Создать персонажа']) expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it('routes GM access panels and the legacy members route to scoped membership data', async () => {
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns/12') return response(campaign());
      if (url === '/api/campaigns/12/permissions') return response({ ...permissions(), canManageAccess: true });
      if (url === '/api/campaigns/12/members') return response([]);
      if (url === '/api/campaigns/12/characters') return response([]);
      return response([]);
    });
    renderApp('/12/users', request);
    expect(await screen.findByRole('heading', { name: 'Участники кампании' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Участники и доступ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Настройки' })).toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url === '/api/campaigns/12/members')).toBe(true);
    expect(request.mock.calls.some(([url]) => url.includes('/assignments'))).toBe(false);
  });

  it('keeps player direct GM links out of membership and assignment APIs', async () => {
    for (const route of ['/12/gm/members', '/12/gm/settings']) {
      const request = vi.fn(async (url: string) => {
        if (url === '/api/campaigns/12') return response(campaign());
        if (url === '/api/campaigns/12/permissions') return response(permissions(false));
        if (url === '/api/campaigns/12/characters') return response([]);
        return response([]);
      });
      const view = renderApp(route, request);
      expect(await screen.findByRole('heading', { name: 'Мои персонажи' })).toBeInTheDocument();
      expect(request.mock.calls.some(([url]) => /\/members|\/assignments/.test(url))).toBe(false);
      view.unmount();
    }
  });

  it('routes legacy settings and saves only the campaign name', async () => {
    const renamed = { ...campaign(), name: 'Renamed', metadataRevision: 2 };
    let currentCampaign = campaign();
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/campaigns/12' && options?.method === 'PUT') { currentCampaign = renamed; return response(renamed); }
      if (url === '/api/campaigns/12') return response(currentCampaign);
      if (url === '/api/campaigns/12/permissions') return response(permissions());
      return response([]);
    });
    renderApp('/12/settings', request);
    fireEvent.change(await screen.findByLabelText('Название кампании'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/campaigns/12', expect.objectContaining({ method: 'PUT', body: expect.any(String) })));
    const write = request.mock.calls.find(([url, options]) => url === '/api/campaigns/12' && options?.method === 'PUT');
    expect(JSON.parse(String(write?.[1]?.body))).toEqual({ name: 'Renamed', expectedRevision: 1 });
    expect(await screen.findByText('Название сохранено.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Renamed' })).toBeInTheDocument();
  });

  it('denies GM routes without canWrite and independently groups character grants for players', async () => {
    const id = 'abcdef01-2345-6789-abcd-ef0123456789';
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns/12') return response(campaign());
      if (url === '/api/campaigns/12/permissions') return response(permissions(false));
      if (url === '/api/campaigns/12/characters') return response([{ id, campaignId: 12, templateId: 't', name: 'Hero', importance: 'Key', metadataRevision: 1 }]);
      if (url === `/api/campaigns/12/characters/${id}/permissions`) return response({ canRead: true, canWrite: true, canManageAccess: false });
      return response([]);
    });
    const gm = renderApp('/12/gm/overview', request);
    expect(await screen.findByRole('heading', { name: 'Мои персонажи' })).toBeInTheDocument();
    gm.unmount();
    renderApp('/12/player/characters', request);
    expect(await screen.findByText('Hero')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Могу вести' })).toBeInTheDocument();
    expect(screen.getByText('Можно вести и редактировать')).toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url === `/api/campaigns/12/characters/${id}/permissions`)).toBe(true);
  });

  it('keeps a character pending until its permissions resolve and reports permission errors distinctly', async () => {
    let resolve!: (value: Response) => void;
    const pending = new Promise<Response>(done => { resolve = done; });
    const id = 'abcdef02-2345-6789-abcd-ef0123456789';
    const request = vi.fn(async (url: string) => url === '/api/campaigns/12' ? response(campaign()) : url === '/api/campaigns/12/permissions' ? response(permissions(false)) : url === '/api/campaigns/12/characters' ? response([{ id, campaignId: 12, templateId: 't', name: 'Pending hero', importance: 'Secondary', metadataRevision: 1 }]) : url.endsWith(`/characters/${id}/permissions`) ? pending : response([]));
    renderApp('/12/player/characters', request);
    expect(await screen.findByText('Загрузка прав персонажа «Pending hero»…')).toBeInTheDocument();
    expect(screen.queryByText('Только просмотр')).not.toBeInTheDocument();
    resolve(response({ code: 'forbidden', title: 'Forbidden', detail: 'No access' }, 403));
    expect(await screen.findByText(/Не удалось загрузить права для 1 персонажей/)).toBeInTheDocument();
  });

  it('separates empty and unmatched character searches without loading future APIs', async () => {
    const id = 'abcdef03-2345-6789-abcd-ef0123456789';
    const request = vi.fn(async (url: string) => url === '/api/campaigns/12' ? response(campaign()) : url === '/api/campaigns/12/permissions' ? response(permissions(false)) : url === '/api/campaigns/12/characters' ? response([{ id, campaignId: 12, templateId: 't', name: 'Hero', importance: 'Background', metadataRevision: 1 }]) : url.endsWith('/permissions') ? response({ canRead: true, canWrite: false, canManageAccess: false }) : response([]));
    renderApp('/12/player/characters', request);
    expect(await screen.findByText('Hero')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Поиск персонажей'), { target: { value: 'missing' } });
    expect(screen.getByText('Совпадений нет.')).toBeInTheDocument();
    expect(request.mock.calls.map(([url]) => url).some(url => /templates|members|assignments|sheet|computed-sheet/.test(url))).toBe(false);
  });

  it('redirects supported legacy character routes to the matching basic tab', async () => {
    const id = 'abcdef01-2345-6789-abcd-ef0123456789';
    for (const [legacy, tab] of [['', 'overview'], ['/stats', 'stats'], ['/base', 'overview'], ['/resources', 'overview']]) {
      const request = vi.fn(async (url: string) => {
        if (url === '/api/campaigns/12') return response(campaign());
        if (url === '/api/campaigns/12/permissions') return response(permissions());
        if (url === `/api/campaigns/12/characters/${id}`) return response({ id, campaignId: 12, templateId: 'template', name: 'Hero', importance: 'Key', metadataRevision: 1 });
        if (url.endsWith('/character-permissions')) return response(permissions());
        if (url.endsWith(`/characters/${id}/permissions`)) return response(permissions());
        if (url.endsWith(`/characters/${id}/sheet`)) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [] });
        if (url.endsWith('/characters')) return response([{ id, campaignId: 12, templateId: 'template', name: 'Hero', importance: 'Key', metadataRevision: 1 }]);
        return response([]);
      });
      const view = renderApp(`/12/character/${id}${legacy}`, request);
      const sheetNavigation = await screen.findByRole('navigation', { name: 'Лист персонажа' });
      await waitFor(() => expect(within(sheetNavigation).getByRole('link', { name: tab === 'stats' ? 'Характеристики' : 'Обзор' })).toHaveAttribute('aria-current', 'page'));
      expect(request.mock.calls.some(([url]) => url.includes('/computed-sheet'))).toBe(false);
      view.unmount();
    }
  });

  it('preserves character identity and active tab when switching modes', async () => {
    const id = 'abcdef01-2345-6789-abcd-ef0123456789';
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns/12') return response(campaign());
      if (url === '/api/campaigns/12/permissions') return response(permissions());
      if (url.endsWith(`/characters/${id}/permissions`)) return response(permissions(false));
      if (url.endsWith(`/characters/${id}/sheet`)) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [] });
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, templateId: 'template', name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/characters')) return response([{ id, campaignId: 12, templateId: 'template', name: 'Hero', importance: 'Key', metadataRevision: 1 }]);
      return response([]);
    });
    renderApp(`/12/gm/characters/${id}/stats`, request);
    expect(await screen.findByRole('link', { name: 'Характеристики' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Пространство игрока' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Характеристики' })).toHaveAttribute('href', `/12/player/characters/${id}/stats`));
    expect(request.mock.calls.some(([url]) => url === `/api/campaigns/12/characters/${id}/permissions`)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Пространство мастера' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Характеристики' })).toHaveAttribute('href', `/12/gm/characters/${id}/stats`));
  });

  it.each([403, 404])('falls back to the target character list when mode access returns %s', async status => {
    const id = 'abcdef01-2345-6789-abcd-ef0123456789';
    let characterPermissionReads = 0;
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns/12') return response(campaign());
      if (url === '/api/campaigns/12/permissions') return response(permissions());
      if (url.endsWith(`/characters/${id}/permissions`)) {
        characterPermissionReads += 1;
        return characterPermissionReads === 1 ? response({ canRead: true, canWrite: false, canManageAccess: false }) : response({ code: 'forbidden', title: 'Denied', detail: 'Denied' }, status);
      }
      if (url.endsWith(`/characters/${id}/sheet`)) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [] });
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, templateId: 'template', name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/characters')) return response([{ id, campaignId: 12, templateId: 'template', name: 'Hero', importance: 'Key', metadataRevision: 1 }]);
      return response([]);
    });
    renderApp(`/12/gm/characters/${id}/stats`, request);
    await screen.findByRole('link', { name: 'Характеристики' });
    fireEvent.click(screen.getByRole('button', { name: 'Пространство игрока' }));
    expect(await screen.findByRole('heading', { name: 'Мои персонажи' })).toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url.endsWith('/assignments'))).toBe(false);
  });

  it('keeps the character tab on non-access errors while switching modes', async () => {
    const id = 'abcdef01-2345-6789-abcd-ef0123456789';
    let characterPermissionReads = 0;
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns/12') return response(campaign());
      if (url === '/api/campaigns/12/permissions') return response(permissions());
      if (url.endsWith(`/characters/${id}/permissions`)) {
        characterPermissionReads += 1;
        return characterPermissionReads === 1 ? response({ canRead: true, canWrite: false, canManageAccess: false }) : response({ code: 'dependency_unavailable', title: 'Unavailable', detail: 'Try later' }, 503);
      }
      if (url.endsWith(`/characters/${id}/sheet`)) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [] });
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, templateId: 'template', name: 'Hero', importance: 'Key', metadataRevision: 1 });
      return response([]);
    });
    renderApp(`/12/gm/characters/${id}/stats`, request);
    await screen.findByRole('link', { name: 'Характеристики' });
    fireEvent.click(screen.getByRole('button', { name: 'Пространство игрока' }));
    expect(await screen.findByText('Try later')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Характеристики' })).toHaveAttribute('href', `/12/gm/characters/${id}/stats`);
    expect(screen.queryByRole('heading', { name: 'Мои персонажи' })).not.toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url.endsWith('/computed-sheet'))).toBe(false);
  });

  it('shows the empty character state after a successful empty list, not a numeric zero', async () => {
    const request = vi.fn(async (url: string) => url === '/api/campaigns/12' ? response(campaign()) : url === '/api/campaigns/12/permissions' ? response(permissions(false)) : response([]));
    renderApp('/12/player/characters', request);
    expect(await screen.findByText('Персонажей пока нет.')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('resets workspace drafts when the authenticated user changes', async () => {
    const request = vi.fn(async () => response([]));
    const view = render(<MemoryRouter initialEntries={['/']}><App auth={makeAuth(request, 4)} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Создать кампанию' }));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'private draft' } });
    view.rerender(<MemoryRouter initialEntries={['/']}><App auth={makeAuth(request, 5)} /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByLabelText('Название')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Создать кампанию' })).toBeInTheDocument();
  });

  it('switches modes and campaigns with isolated campaign IDs', async () => {
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns') return response([campaign(), campaign(13)]);
      if (url === '/api/campaigns/12') return response(campaign());
      if (url === '/api/campaigns/13') return response(campaign(13));
      if (url.endsWith('/permissions')) return response(permissions(true));
      if (url.endsWith('/characters')) return response([]);
      return response([]);
    });
    renderApp('/12/gm/characters', request);
    fireEvent.click(await screen.findByRole('button', { name: 'Пространство игрока' }));
    expect(await screen.findByRole('heading', { name: 'Мои персонажи' })).toBeInTheDocument();
    await screen.findByRole('option', { name: 'Campaign 13' });
    fireEvent.change(screen.getByLabelText('Кампания'), { target: { value: '13' } });
    await waitFor(() => expect(request.mock.calls.some(([url]) => url === '/api/campaigns/13/permissions')).toBe(true));
    expect(await screen.findByRole('heading', { name: 'Campaign 13' })).toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url === '/api/campaigns/12/characters')).toBe(true);
    expect(request.mock.calls.some(([url]) => url === '/api/campaigns/13/characters')).toBe(true);
  });

  it('supports standalone, nested Hub paths, and Home campaign creation links', async () => {
    const request = vi.fn(async () => response([]));
    const standalone = renderApp('/', request);
    expect(await screen.findByRole('heading', { name: 'Кампании' })).toBeInTheDocument();
    const home = render(<MemoryRouter initialEntries={['/groups']}><Routes><Route path="/groups/*" element={<Home auth={makeAuth(request)} />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Создать кампанию' })).toHaveAttribute('href', '/groups?create=1');
    expect(screen.queryByLabelText('Название')).not.toBeInTheDocument();
    home.unmount();
    standalone.unmount();
    const nestedRequest = vi.fn(async (url: string) => url === '/api/campaigns' ? response([campaign()]) : url.endsWith('/permissions') ? response(permissions()) : response([]));
    render(<MemoryRouter basename="/tdn" initialEntries={['/tdn']}><App auth={makeAuth(nestedRequest)} /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Кампании' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Играть' })).toHaveAttribute('href', '/tdn/12/player/characters');
  });
});
