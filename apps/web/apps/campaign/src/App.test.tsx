import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import App from './App';
import Home from './Home';
import type { HubRemoteProps } from '@tdn/shared';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const makeAuth = (request: (url: string, options?: RequestInit) => Promise<Response>, userId = 4) => ({ status: 'authenticated', authenticated: true, userId, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request: async (url: string, options?: RequestInit) => {
  const result = await request(url, options);
  if (!result.ok) return result;
  const body = await result.clone().json().catch(() => undefined);
  if (url.endsWith('/presentation') && Array.isArray(body) && body.length === 0) return response({ contentRevision: 1, defaults: { page_1: 'view-one', page_2: 'view-two' }, contextParams: { page_1: { title: 'Основное' }, page_2: { title: 'Дополнительно' } } });
  if (url.includes('/presentation/resolve?') && Array.isArray(body) && body.length === 0) {
    const contextKey = new URL(url, 'http://localhost').searchParams.get('contextKey') ?? '';
    return response({ contextKey, viewMetadata: { id: contextKey, key: contextKey, campaignId: 12, name: contextKey, metadataRevision: 1 }, viewContent: { campaignId: 12, resourceId: contextKey, contentRevision: 1, data: { roots: [] } }, contextParams: null, contentRevision: 1 });
  }
  return result;
}, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }) as unknown as HubRemoteProps['auth'];
const campaign = (id = 12) => ({ id, name: `Campaign ${id}`, metadataRevision: 1 });
const permissions = (canWrite = true) => ({ canRead: true, canWrite, canManageAccess: false });
const renderApp = (initial: string, request: (url: string, options?: RequestInit) => Promise<Response>) => render(<MemoryRouter initialEntries={[initial]}><App auth={makeAuth(request)} /></MemoryRouter>);
const CurrentPath: React.FC = () => <output aria-label="Current pathname">{useLocation().pathname}</output>;

describe('campaign first iteration', () => {
  beforeEach(() => window.localStorage.clear());

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

  it('routes views and safely rejects unsupported destinations', async () => {
    const supported = vi.fn(async (url: string, _options?: RequestInit) => url.endsWith('/permissions') ? response(permissions()) : url === '/api/campaigns/12' ? response(campaign()) : url.endsWith('/views') ? response([]) : response([]));
    const supportedView = renderApp('/12/gm/views', supported);
    expect(await screen.findByRole('heading', { name: 'Отображения' })).toBeInTheDocument();
    expect(supported.mock.calls.some(([url]) => url === '/api/campaigns/12/views')).toBe(true);
    expect(supported.mock.calls.some(([url, options]) => url.includes('/views') && options?.method === 'DELETE')).toBe(false);
    supportedView.unmount();
    const unsupported = ['/12/quests', '/12/items', '/12/player/characters/abcdef01-2345-6789-abcd-ef0123456789/all-stats', ...['items', 'skills', 'quests', 'notes'].map(tab => `/12/character/abcdef01-2345-6789-abcd-ef0123456789/${tab}`)];
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
    const campaignNavigation = within(screen.getByRole('navigation', { name: 'Разделы кампании' }));
    expect(campaignNavigation.getByRole('link', { name: 'Обзор' })).toBeInTheDocument();
    expect(campaignNavigation.getByRole('link', { name: 'Персонажи' })).toBeInTheDocument();
    expect(campaignNavigation.getByRole('link', { name: 'Шаблон' })).toBeInTheDocument();
    expect(campaignNavigation.getByRole('link', { name: 'Представления' })).toBeInTheDocument();
    expect(campaignNavigation.queryByRole('link', { name: /Предметы|Навыки|Задания|Заметки|Отряды/ })).toBeNull();
    for (const label of ['Создать персонажа']) expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  const fullStatsFixture = (characterCanWrite = true, presentationFails = false) => {
    const id = 'abcdef01-2345-6789-abcd-ef0123456789';
    const fieldId = '11111111-1111-4111-8111-111111111111';
    let currentSheet = { contentRevision: 7, templateContentRevision: 1, description: '', baseFields: [{ id: fieldId, key: 'strength', title: 'Сила', description: '', valueType: 'Integer', typeRevision: 1, options: [], effectiveValue: 3, isExplicit: true }], virtualFields: [{ id: '22222222-2222-4222-8222-222222222222', key: 'defense', title: 'Защита', description: '', resultType: 'Integer', value: 6, diagnostic: null }, { id: '33333333-3333-4333-8333-333333333333', key: 'broken', title: 'Ошибка расчёта', description: '', resultType: 'Integer', value: null, diagnostic: { code: 'formula_error', message: 'secret details' } }], formulaContentRevisions: [] };
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/campaigns/12') return response(campaign());
      if (url === '/api/campaigns/12/permissions') return response(permissions());
      if (url === `/api/campaigns/12/characters/${id}`) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url === `/api/campaigns/12/characters/${id}/permissions`) return response({ ...permissions(characterCanWrite), canManageAccess: false });
      if (url === `/api/campaigns/12/characters/${id}/computed-sheet`) return response(currentSheet);
      if (url === '/api/campaigns/12/presentation') return presentationFails ? response({}, 503) : response({ contentRevision: 1, defaults: {}, contextParams: {} });
      if (url === `/api/campaigns/12/characters/${id}/base-values/${fieldId}` && options?.method === 'PUT') {
        const body = JSON.parse(String(options.body)) as { value: number };
        currentSheet = { ...currentSheet, contentRevision: 8, baseFields: currentSheet.baseFields.map(field => ({ ...field, effectiveValue: body.value })) };
        return response(currentSheet);
      }
      return response([]);
    });
    return { id, fieldId, request };
  };

  it('opens GM full stats without assigned pages and writes only the selected base value', async () => {
    const { id, fieldId, request } = fullStatsFixture();
    renderApp(`/12/gm/characters/${id}`, request);
    const table = await screen.findByRole('table', { name: 'Все характеристики' });
    expect(await screen.findByRole('link', { name: 'Все характеристики' })).toHaveAttribute('aria-current', 'page');
    expect(within(table).getByText('Сила')).toBeInTheDocument();
    expect(within(table).getByText('Защита')).toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: 'Изменить показатель Защита' })).not.toBeInTheDocument();
    expect(within(table).getByText('Не удалось вычислить значение.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('secret details');

    const search = screen.getByRole('textbox', { name: 'Поиск характеристик' });
    fireEvent.change(search, { target: { value: '  сИлА  ' } });
    expect(within(table).getByText('Сила')).toBeInTheDocument();
    expect(within(table).queryByText('Защита')).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: '' } });
    const filter = screen.getByRole('combobox', { name: 'Фильтр характеристик' });
    fireEvent.change(filter, { target: { value: 'errors' } });
    expect(within(table).getByText('Не удалось вычислить значение.')).toBeInTheDocument();
    expect(within(table).queryByText('Сила')).not.toBeInTheDocument();
    expect(within(table).queryByText('Защита')).not.toBeInTheDocument();
    fireEvent.change(filter, { target: { value: 'all' } });

    fireEvent.click(within(table).getByRole('button', { name: 'Изменить показатель Сила' }));
    let input = await screen.findByRole('textbox', { name: 'Сила' });
    fireEvent.change(input, { target: { value: '-' } });
    fireEvent.blur(input, { relatedTarget: document.body });
    fireEvent.change(search, { target: { value: 'не найдено' } });
    const recovery = await screen.findByRole('region', { name: 'Неподтверждённые значения' });
    expect(within(recovery).getByRole('textbox', { name: 'Сила' })).toHaveValue('-');
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    fireEvent.change(search, { target: { value: '' } });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Неподтверждённые значения' })).not.toBeInTheDocument());
    fireEvent.click(within(await screen.findByRole('table', { name: 'Все характеристики' })).getByRole('button', { name: 'Изменить показатель Сила' }));
    input = await screen.findByRole('textbox', { name: 'Сила' });
    expect(input).toHaveValue('-');
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.blur(input, { relatedTarget: document.body });
    await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1));
    const [url, options] = request.mock.calls.find(([, requestOptions]) => requestOptions?.method === 'PUT')!;
    expect(url).toBe(`/api/campaigns/12/characters/${id}/base-values/${fieldId}`);
    expect(String(options?.body)).toBe('{"value":9,"expectedRevision":7}');
  });

  it('keeps GM full stats read-only without presentation and returns the same character to player space', async () => {
    const { id, request } = fullStatsFixture(false, true);
    renderApp(`/12/gm/characters/${id}/all-stats`, request);
    const table = await screen.findByRole('table', { name: 'Все характеристики' });
    expect(within(table).getByText('Защита')).toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: /Изменить показатель/ })).not.toBeInTheDocument();
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    fireEvent.change(screen.getByRole('combobox', { name: 'Окружение' }), { target: { value: 'player' } });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Окружение' })).toHaveValue('player'));
    expect(await screen.findByRole('heading', { name: 'Hero' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Инструменты мастера' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Все характеристики' })).not.toBeInTheDocument();
  });

  it('opens the singleton campaign template from GM navigation without plural API routes', async () => {
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns/12') return response(campaign());
      if (url === '/api/campaigns/12/permissions') return response(permissions());
      if (url === '/api/campaigns/12/template') return response({ campaignId: 12, name: 'Campaign 12', metadataRevision: 1 });
      if (url === '/api/campaigns/12/template/content') return response({ campaignId: 12, contentRevision: 0, data: { description: '', baseFields: [], virtualFields: [] } });
      if (url === '/api/campaigns') return response([campaign()]);
      return response([]);
    });
    renderApp('/12/gm/overview', request);
    fireEvent.click(await screen.findByRole('link', { name: 'Шаблон' }));
    expect(await screen.findByRole('heading', { name: 'Шаблон кампании' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Базовые поля' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Виртуальные поля' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Метаданные' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Название')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Описание')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Выбранный шаблон')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать шаблон' })).not.toBeInTheDocument();
    await waitFor(() => expect(request.mock.calls.some(([url]) => url === '/api/campaigns/12/formulas')).toBe(true));
    expect(request.mock.calls.map(([url]) => url).filter(url => url.startsWith('/api/')).some(url => url.includes('/templates'))).toBe(false);
    expect(request.mock.calls.some(([url]) => url === '/api/campaigns/12/template')).toBe(false);
    expect(request.mock.calls.some(([url]) => url === '/api/campaigns/12/template/content')).toBe(true);
    expect(request.mock.calls.some(([url]) => url === '/api/campaigns/12/formulas')).toBe(true);
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
    expect(await screen.findByLabelText('Никнейм')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Разделы кампании' })).getByRole('link', { name: 'Управление' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Управление кампанией' })).getByRole('link', { name: 'Участники' })).toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url === '/api/campaigns/12/members')).toBe(true);
    expect(request.mock.calls.some(([url]) => url.includes('/assignments'))).toBe(false);
  });

  it('keeps player direct GM links out of membership and assignment APIs', async () => {
    for (const route of ['/12/gm/members', '/12/gm/settings', '/12/gm/settings/members', '/12/gm/settings/export', '/12/gm/views']) {
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
    expect(await screen.findByRole('option', { name: 'Renamed' })).toBeInTheDocument();
    expect(screen.getByLabelText('Кампания')).toHaveValue('12');
  });

  it('denies GM routes without canWrite and independently groups character grants for players', async () => {
    const id = 'abcdef01-2345-6789-abcd-ef0123456789';
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns/12') return response(campaign());
      if (url === '/api/campaigns/12/permissions') return response(permissions(false));
      if (url === '/api/campaigns/12/characters') return response([{ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 }]);
      if (url === `/api/campaigns/12/characters/${id}/permissions`) return response({ canRead: true, canWrite: true, canManageAccess: false });
      return response([]);
    });
    const gm = renderApp('/12/gm/overview', request);
    expect(await screen.findByRole('heading', { name: 'Мои персонажи' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Окружение' })).not.toBeInTheDocument();
    gm.unmount();
    renderApp('/12/player/characters', request);
    expect(await screen.findByRole('heading', { name: 'Hero' })).toBeInTheDocument();
    const canLead = await screen.findByRole('region', { name: 'Могу вести' });
    expect(within(canLead).getByText('Hero')).toBeInTheDocument();
    expect(screen.queryByText('Можно вести и редактировать')).not.toBeInTheDocument();
    expect(screen.queryByText('Только просмотр')).not.toBeInTheDocument();
    expect(screen.queryByText('Права на каждого персонажа определяются отдельно.')).not.toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url === `/api/campaigns/12/characters/${id}/permissions`)).toBe(true);
  });

  it('keeps a character pending until its permissions resolve and reports permission errors distinctly', async () => {
    let resolve!: (value: Response) => void;
    const pending = new Promise<Response>(done => { resolve = done; });
    const id = 'abcdef02-2345-6789-abcd-ef0123456789';
    const request = vi.fn(async (url: string) => url === '/api/campaigns/12' ? response(campaign()) : url === '/api/campaigns/12/permissions' ? response(permissions(false)) : url === '/api/campaigns/12/characters' ? response([{ id, campaignId: 12, name: 'Pending hero', importance: 'Secondary', metadataRevision: 1 }]) : url.endsWith(`/characters/${id}/permissions`) ? pending : response([]));
    renderApp('/12/player/characters', request);
    await waitFor(() => expect(request.mock.calls.some(([url]) => url === `/api/campaigns/12/characters/${id}/permissions`)).toBe(true));
    expect(screen.queryByRole('heading', { name: 'Pending hero' })).not.toBeInTheDocument();
    resolve(response({ code: 'forbidden', title: 'Forbidden', detail: 'No access' }, 403));
    expect(await screen.findByText(/Не удалось загрузить права для 1 персонажей/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pending hero' })).not.toBeInTheDocument();
  });

  it('separates empty and unmatched character searches without loading future APIs', async () => {
    const id = 'abcdef03-2345-6789-abcd-ef0123456789';
    const request = vi.fn(async (url: string) => url === '/api/campaigns/12' ? response(campaign()) : url === '/api/campaigns/12/permissions' ? response(permissions(false)) : url === '/api/campaigns/12/characters' ? response([{ id, campaignId: 12, name: 'Hero', importance: 'Background', metadataRevision: 1 }]) : url.endsWith('/permissions') ? response({ canRead: true, canWrite: false, canManageAccess: false }) : response([]));
    renderApp('/12/player/characters', request);
    expect(await screen.findByText('Hero')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Поиск персонажей'), { target: { value: 'missing' } });
    expect(screen.getByText('Совпадений нет.')).toBeInTheDocument();
    expect(request.mock.calls.map(([url]) => url).some(url => /templates|members|assignments|sheet|computed-sheet/.test(url))).toBe(false);
  });

  it('redirects supported legacy character routes to the first configured page', async () => {
    const id = 'abcdef01-2345-6789-abcd-ef0123456789';
    for (const legacy of ['', '/stats', '/base', '/resources']) {
      const request = vi.fn(async (url: string) => {
        if (url === '/api/campaigns/12') return response(campaign());
        if (url === '/api/campaigns/12/permissions') return response(permissions());
        if (url === `/api/campaigns/12/characters/${id}`) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
        if (url.endsWith('/character-permissions')) return response(permissions());
        if (url.endsWith(`/characters/${id}/permissions`)) return response(permissions());
        if (url.endsWith(`/characters/${id}/computed-sheet`)) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [], virtualFields: [], formulaContentRevisions: [] });
        if (url.endsWith('/characters')) return response([{ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 }]);
        return response([]);
      });
       const view = renderApp(`/12/character/${id}${legacy}`, request);
       const sheetNavigation = await screen.findByRole('navigation', { name: 'Страницы персонажа' });
       await waitFor(() => expect(within(sheetNavigation).getByRole('link', { name: 'Основное' })).toHaveAttribute('aria-current', 'page'));
      expect(request.mock.calls.some(([url]) => url.endsWith('/computed-sheet'))).toBe(true);
      expect(request.mock.calls.map(([url]) => url).some(url => /formulas|virtual-fields|custom-virtual-fields|virtual-overrides|assignments/.test(url))).toBe(false);
      view.unmount();
    }
  });

  it('preserves character identity and active tab when switching modes', async () => {
    const id = 'abcdef01-2345-6789-abcd-ef0123456789';
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns/12') return response(campaign());
      if (url === '/api/campaigns/12/permissions') return response(permissions());
      if (url.endsWith(`/characters/${id}/permissions`)) return response(permissions(false));
      if (url.endsWith(`/characters/${id}/computed-sheet`)) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [], virtualFields: [], formulaContentRevisions: [] });
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/characters')) return response([{ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 }]);
      return response([]);
    });
    renderApp(`/12/gm/characters/${id}/page_2`, request);
    expect(await screen.findByRole('link', { name: 'Дополнительно' })).toHaveAttribute('aria-current', 'page');
    fireEvent.change(screen.getByRole('combobox', { name: 'Окружение' }), { target: { value: 'player' } });
    await waitFor(() => expect(screen.getByRole('link', { name: 'Дополнительно' })).toHaveAttribute('href', `/12/player/characters/${id}/page_2`));
    expect(screen.getByRole('combobox', { name: 'Окружение' })).toHaveValue('player');
    expect(screen.getByRole('link', { name: 'Дополнительно' })).toHaveAttribute('aria-current', 'page');
    expect(request.mock.calls.some(([url]) => url === `/api/campaigns/12/characters/${id}/permissions`)).toBe(true);
    expect(request.mock.calls.some(([url]) => url.endsWith('/computed-sheet'))).toBe(true);
    expect(request.mock.calls.map(([url]) => url).some(url => /formulas|virtual-fields|custom-virtual-fields|virtual-overrides|assignments/.test(url))).toBe(false);
    fireEvent.change(screen.getByRole('combobox', { name: 'Окружение' }), { target: { value: 'gm' } });
    await waitFor(() => expect(screen.getByRole('link', { name: 'Дополнительно' })).toHaveAttribute('href', `/12/gm/characters/${id}/page_2`));
    expect(screen.getByRole('link', { name: 'Дополнительно' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('combobox', { name: 'Окружение' })).toHaveValue('gm');
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
      if (url.endsWith(`/characters/${id}/computed-sheet`)) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [], virtualFields: [], formulaContentRevisions: [] });
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/characters')) return response([{ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 }]);
      return response([]);
    });
    renderApp(`/12/gm/characters/${id}/page_2`, request);
    await screen.findByRole('link', { name: 'Дополнительно' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Окружение' }), { target: { value: 'player' } });
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
      if (url.endsWith(`/characters/${id}/computed-sheet`)) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [], virtualFields: [], formulaContentRevisions: [] });
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      return response([]);
    });
    renderApp(`/12/gm/characters/${id}/page_2`, request);
    await screen.findByRole('link', { name: 'Дополнительно' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Окружение' }), { target: { value: 'player' } });
    expect(await screen.findByText('Зависимый сервис временно недоступен.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Try later');
    expect(document.body.textContent).not.toContain('dependency_unavailable');
    expect(screen.getByRole('link', { name: 'Дополнительно' })).toHaveAttribute('href', `/12/gm/characters/${id}/page_2`);
    expect(screen.getByRole('combobox', { name: 'Окружение' })).toHaveValue('gm');
    expect(screen.getByRole('link', { name: 'Дополнительно' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('heading', { name: 'Мои персонажи' })).not.toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url.endsWith('/computed-sheet'))).toBe(true);
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
    fireEvent.change(await screen.findByRole('combobox', { name: 'Окружение' }), { target: { value: 'player' } });
    expect(await screen.findByRole('heading', { name: 'Мои персонажи' })).toBeInTheDocument();
    await screen.findByRole('option', { name: 'Campaign 13' });
    fireEvent.change(screen.getByLabelText('Кампания'), { target: { value: '13' } });
    await waitFor(() => expect(request.mock.calls.some(([url]) => url === '/api/campaigns/13/permissions')).toBe(true));
    await waitFor(() => expect(screen.getByLabelText('Кампания')).toHaveValue('13'));
    const currentCampaignSelector = screen.getByLabelText('Кампания');
    expect(within(currentCampaignSelector).getByRole('option', { name: 'Campaign 13' })).toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url === '/api/campaigns/12/characters')).toBe(true);
    await waitFor(() => expect(request.mock.calls.some(([url]) => url === '/api/campaigns/13/characters')).toBe(true));
  });

  it('supports standalone, nested Hub paths, and Home campaign creation links', async () => {
    const request = vi.fn(async () => response([]));
    const standalone = renderApp('/', request);
    expect(await screen.findByRole('heading', { name: 'Кампании' })).toBeInTheDocument();
    standalone.unmount();
    const home = render(<MemoryRouter initialEntries={['/groups']}><Routes><Route path="/groups/*" element={<Home auth={makeAuth(request)} />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Последняя группа' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Последние персонажи' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Создать кампанию' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Название')).not.toBeInTheDocument();
    home.unmount();
    const nestedRequest = vi.fn(async (url: string) => url === '/api/campaigns' ? response([campaign()]) : url === '/api/campaigns/12' ? response(campaign()) : url.endsWith('/permissions') ? response(permissions()) : response([]));
    render(<MemoryRouter basename="/tdn" initialEntries={['/tdn']}><App auth={makeAuth(nestedRequest)} /><CurrentPath /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Кампании' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Вести' }));
    expect(await screen.findByRole('heading', { name: 'Обзор кампании' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Current pathname')).toHaveTextContent('/12/gm/overview'));
  });
});
