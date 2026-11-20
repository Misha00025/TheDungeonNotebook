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
      if (/^\/api\/campaigns\/\d+\/presentation$/.test(url)) return response(presentation);
      if (url.includes('/presentation/resolve?')) return response(resolved(new URL(url, 'http://localhost').searchParams.get('contextKey') ?? ''));
      if (url.endsWith('/template')) return response({ campaignId: 12, name: 'Template', metadataRevision: 1 });
      if (url.endsWith('/template/content')) return response({ campaignId: 12, contentRevision: 0, data: { description: '', baseFields: [], virtualFields: [] } });
      if (/^\/api\/campaigns\/\d+\/(characters|formulas|views|members)$/.test(url)) return response([]);
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter basename={basename || undefined} initialEntries={[initial]}><Routes><Route path="/groups/*" element={<App auth={makeAuth(request)} />} /></Routes><Pathname /></MemoryRouter>);

    const navigation = await screen.findByRole('navigation', { name: 'Разделы кампании' });
    const labels = ['Обзор', 'Персонажи', 'Шаблон', 'Формулы', 'Представления', 'Участники и доступ', 'Настройки'];
    const suffixes = ['gm/overview', 'gm/characters', 'gm/templates', 'gm/formulas', 'gm/views', 'gm/members', 'gm/settings'];
    for (const [index, label] of labels.entries()) expect(within(navigation).getByRole('link', { name: label })).toHaveAttribute('href', `${prefix}/12/${suffixes[index]}`);

    const headings = ['Обзор кампании', 'Персонажи кампании', 'Шаблон кампании', 'Формулы', 'Отображения', 'Участники и доступ', 'Настройки кампании'];
    for (const [index, label] of labels.entries()) {
      fireEvent.click(within(navigation).getByRole('link', { name: label }));
      await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe(`/groups/12/${suffixes[index]}`));
      expect(await screen.findByRole('heading', { name: headings[index] })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Страница не найдена' })).not.toBeInTheDocument();
    }
    expect(request.mock.calls.filter(([url]) => url.startsWith('/api/')).some(([url]) => url.includes('/templates'))).toBe(false);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Разделы кампании' })).getByRole('link', { name: 'Обзор' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/12/gm/overview'));

    fireEvent.change(screen.getByLabelText('Кампания'), { target: { value: '13' } });
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/13/gm/overview'));
    expect(await screen.findByRole('option', { name: 'Campaign 13' })).toBeInTheDocument();
    expect(screen.getByLabelText('Кампания')).toHaveValue('13');
    expect(screen.queryByRole('heading', { name: 'Campaign 13' })).not.toBeInTheDocument();
    await screen.findByRole('navigation', { name: 'Разделы кампании' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Окружение' }), { target: { value: 'player' } });
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/13/player/characters'));
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
    expect(await screen.findByRole('link', { name: 'К персонажам' })).toHaveAttribute('href', `${prefix}/12/gm/characters`);
    fireEvent.click(screen.getByRole('link', { name: 'Дополнительно' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe(`/groups/12/gm/characters/${characterId}/page_2`));
    fireEvent.click(screen.getByRole('link', { name: 'К персонажам' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname').textContent).toBe('/groups/12/gm/characters'));
    expect(await screen.findByRole('heading', { name: 'Персонажи кампании' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Разделы кампании' })).getByRole('link', { name: 'Настройки' }));
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
