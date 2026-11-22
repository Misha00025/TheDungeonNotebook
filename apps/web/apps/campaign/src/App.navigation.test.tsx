import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import App from './App';
import type { HubRemoteProps } from '@tdn/shared';

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const campaign = (id: number) => ({ id, name: `Campaign ${id}`, metadataRevision: 1 });
const presentation = { contentRevision: 1, defaults: { page_1: 'view-one', page_2: 'view-two' }, contextParams: { page_1: { title: 'Основное' }, page_2: { title: 'Дополнительно' } } };
const resolved = (key: string) => ({ contextKey: key, viewMetadata: { id: key, key, campaignId: 12, name: key, metadataRevision: 1 }, viewContent: { campaignId: 12, resourceId: key, contentRevision: 1, data: { roots: [] } }, contextParams: null, contentRevision: 1 });
const makeAuth = (request: (url: string) => Promise<Response>) => ({ status: 'authenticated', authenticated: true, userId: 4, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }) as unknown as HubRemoteProps['auth'];
const Pathname: React.FC = () => { const location = useLocation(); return <output aria-label="Current pathname">{location.pathname}</output>; };

describe('campaign navigation under the Hub route', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

  it.each([{ basename: '', initial: '/groups/12/gm/overview', prefix: '/groups' }, { basename: '/tdn', initial: '/tdn/groups/12/gm/overview', prefix: '/tdn/groups' }])('keeps section links under the matched mount with basename "$basename"', async ({ basename, initial, prefix }) => {
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns') return response([campaign(12), campaign(13)]);
      if (url === '/api/campaigns/12') return response(campaign(12));
      if (url === '/api/campaigns/13') return response(campaign(13));
      if (/^\/api\/campaigns\/(12|13)\/permissions$/.test(url)) return response({ canRead: true, canWrite: true, canManageAccess: true });
      if (/^\/api\/campaigns\/(12|13)\/catalog$/.test(url)) return response([{ id: 'catalog-entry', campaignId: Number(url.split('/')[3]), name: 'Navigation item', kind: 'Item', creatorUserId: null, isHidden: false, quantityUnit: 'Whole', allowNegative: false, metadataRevision: 1 }]);
      if (/^\/api\/campaigns\/(12|13)\/catalog\/groups$/.test(url)) return response({ campaignId: Number(url.split('/')[3]), contentRevision: 0, groups: [] });
      if (/^\/api\/campaigns\/(12|13)\/catalog\/attributes$/.test(url)) return response({ campaignId: Number(url.split('/')[3]), contentRevision: 0, data: { definitions: [] } });
      if (/^\/api\/campaigns\/\d+\/presentation$/.test(url)) return response(presentation);
      if (url.includes('/presentation/resolve?')) return response(resolved(new URL(url, 'http://localhost').searchParams.get('contextKey') ?? ''));
      if (url.endsWith('/template')) return response({ campaignId: 12, name: 'Template', metadataRevision: 1 });
      if (url.endsWith('/template/content')) return response({ campaignId: 12, contentRevision: 0, data: { description: '', baseFields: [], virtualFields: [] } });
      if (/^\/api\/campaigns\/\d+\/(characters|formulas|views|members)$/.test(url)) return response([]);
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter basename={basename || undefined} initialEntries={[initial]}><Routes><Route path="/groups/*" element={<App auth={makeAuth(request)} />} /></Routes><Pathname /></MemoryRouter>);

    const navigation = await screen.findByRole('navigation', { name: 'Разделы кампании' });
    const labels = ['Обзор', 'Персонажи', 'Шаблон', 'Формулы', 'Представления', 'Каталог', 'Управление'];
    const suffixes = ['gm/overview', 'gm/characters', 'gm/templates', 'gm/formulas', 'gm/views', 'gm/catalog', 'gm/settings'];
    for (const [index, label] of labels.entries()) expect(within(navigation).getByRole('link', { name: label })).toHaveAttribute('href', `${prefix}/12/${suffixes[index]}`);

    for (const [index, label] of labels.entries()) {
      fireEvent.click(within(navigation).getByRole('link', { name: label }));
      await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe(`/groups/12/${suffixes[index]}`));
      expect(screen.queryByRole('heading', { name: 'Страница не найдена' })).not.toBeInTheDocument();
      if (suffixes[index] === 'gm/catalog') expect(await screen.findByRole('heading', { name: 'Каталог' })).toBeInTheDocument();
    }
    expect(request.mock.calls.filter(([url]) => url.startsWith('/api/')).some(([url]) => url.includes('/templates'))).toBe(false);
    const managementNavigation = within(screen.getByRole('navigation', { name: 'Управление кампанией' }));
    fireEvent.click(managementNavigation.getByRole('link', { name: 'Участники' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/12/gm/settings/members'));
    expect(await screen.findByLabelText('Никнейм')).toBeInTheDocument();
    fireEvent.click(managementNavigation.getByRole('link', { name: 'Экспорт' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/12/gm/settings/export'));
    fireEvent.click(managementNavigation.getByRole('link', { name: 'Общее' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/12/gm/settings'));
    expect(await screen.findByLabelText('Название кампании')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Разделы кампании' })).getByRole('link', { name: 'Обзор' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/12/gm/overview'));

    fireEvent.change(screen.getByLabelText('Кампания'), { target: { value: '13' } });
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/13/gm/overview'));
    expect(await screen.findByRole('option', { name: 'Campaign 13' })).toBeInTheDocument();
    expect(screen.getByLabelText('Кампания')).toHaveValue('13');
    await screen.findByRole('navigation', { name: 'Разделы кампании' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Окружение' }), { target: { value: 'player' } });
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/13/player/characters'));
    const playerNavigation = await screen.findByRole('navigation', { name: 'Разделы кампании' });
    expect(within(playerNavigation).getByRole('link', { name: 'Каталог' })).toHaveAttribute('href', `${prefix}/13/player/catalog`);
    fireEvent.click(within(playerNavigation).getByRole('link', { name: 'Каталог' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/13/player/catalog'));
    expect(await screen.findByRole('heading', { name: 'Каталог' })).toBeInTheDocument();
    expect(request).toHaveBeenCalled();
  });

  it.each([{ basename: '', prefix: '/groups' }, { basename: '/tdn', prefix: '/tdn/groups' }])('keeps GUID sheet tabs under the mount "$prefix" and guards dirty settings navigation', async ({ basename, prefix }) => {
    const characterId = 'abcdef01-2345-6789-abcd-ef0123456789';
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns') return response([campaign(12)]);
      if (url === '/api/campaigns/12') return response(campaign(12));
      if (url === '/api/campaigns/12/permissions') return response({ canRead: true, canWrite: true, canManageAccess: true });
      if (url === `/api/campaigns/12/characters/${characterId}`) return response({ id: characterId, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url === `/api/campaigns/12/characters/${characterId}/permissions`) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url === `/api/campaigns/12/characters/${characterId}/computed-sheet`) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [], virtualFields: [], formulaContentRevisions: [] });
      if (url === '/api/campaigns/12/characters') return response([]);
      if (url === '/api/campaigns/12/presentation') return response(presentation);
      if (url.includes('/presentation/resolve?')) return response(resolved(new URL(url, 'http://localhost').searchParams.get('contextKey') ?? ''));
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter basename={basename || undefined} initialEntries={[`${basename}/groups/12/gm/characters/${characterId}/page_2`]}><Routes><Route path="/groups/*" element={<App auth={makeAuth(request)} />} /></Routes><Pathname /></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe(`/groups/12/gm/characters/${characterId}/page_2`));
    const sheetNavigation = await screen.findByRole('navigation', { name: 'Страницы персонажа' });
    expect(within(sheetNavigation).getByRole('link', { name: 'Дополнительно' })).toHaveAttribute('href', `${prefix}/12/gm/characters/${characterId}/page_2`);
    fireEvent.click(within(sheetNavigation).getByRole('link', { name: 'Основное' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe(`/groups/12/gm/characters/${characterId}/page_1`));
    const campaignNavigation = within(screen.getByRole('navigation', { name: 'Разделы кампании' }));
    expect(campaignNavigation.getByRole('link', { name: 'Персонажи' })).toHaveAttribute('href', `${prefix}/12/gm/characters`);
    fireEvent.click(screen.getByRole('link', { name: 'Дополнительно' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe(`/groups/12/gm/characters/${characterId}/page_2`));
    fireEvent.click(campaignNavigation.getByRole('link', { name: 'Персонажи' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/12/gm/characters'));
    expect(await screen.findByRole('heading', { name: 'Персонажи кампании' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Разделы кампании' })).getByRole('link', { name: 'Управление' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/12/gm/settings'));
    const nameInput = await screen.findByLabelText('Название кампании');
    fireEvent.change(nameInput, { target: { value: 'Unsaved change' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const overview = within(screen.getByRole('navigation', { name: 'Разделы кампании' })).getByRole('link', { name: 'Обзор' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Окружение' }), { target: { value: 'player' } });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/12/gm/settings');
    expect(screen.getByLabelText('Название кампании')).toHaveValue('Unsaved change');
    expect(screen.getByRole('combobox', { name: 'Окружение' })).toHaveValue('gm');
    fireEvent.click(overview);
    expect(await screen.findByRole('heading', { name: 'Обзор кампании' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/12/gm/overview'));
    expect(confirm).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });
});
