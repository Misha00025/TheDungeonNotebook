import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { HubRemoteProps } from '@tdn/shared';
import App from './App';
import { CampaignApiError } from './workspace/api';
import { ApiError } from './workspace/Feedback';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const campaign = { id: 12, name: 'Pilot campaign', metadataRevision: 1 };
const playerCharacters = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', campaignId: 12, name: 'Writable hero', importance: 'Key', metadataRevision: 1 },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', campaignId: 12, name: 'Read only hero', importance: 'Background', metadataRevision: 1 },
];
const makeAuth = (request: (url: string, options?: RequestInit) => Promise<Response>) => ({ status: 'authenticated', authenticated: true, userId: 4, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }) as unknown as HubRemoteProps['auth'];
const CurrentPath: React.FC = () => <output aria-label="Current pathname">{useLocation().pathname}</output>;
const renderPilot = (request: (url: string, options?: RequestInit) => Promise<Response>, initial: string) => render(
  <MemoryRouter basename="/tdn" initialEntries={[`/tdn${initial}`]}>
    <Routes><Route path="/groups/*" element={<App auth={makeAuth(request)} />} /></Routes>
    <CurrentPath />
  </MemoryRouter>
);

describe('campaign SDK pilot', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

  it.each([
    [403, 'Доступ запрещён.'],
    [404, 'Ресурс не найден.'],
    [503, 'Зависимый сервис временно недоступен.'],
  ] as const)('preserves API error feedback for status %s', (status, message) => {
    render(<ApiError error={new CampaignApiError(status, { code: 'failure', title: 'Failure', detail: 'Details' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByText('Код: failure')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
  });

  it('shows player characters in independent permission groups without creation controls', async () => {
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/campaigns') return response([campaign]);
      if (url === '/api/campaigns/12') return response(campaign);
      if (url === '/api/campaigns/12/permissions') return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url === '/api/campaigns/12/characters') return response(playerCharacters);
      if (url.endsWith(`${playerCharacters[0].id}/permissions`)) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith(`${playerCharacters[1].id}/permissions`)) return response({ canRead: true, canWrite: false, canManageAccess: false });
      throw new Error(`Unexpected request: ${url}`);
    });
    renderPilot(request, '/groups/12/player/characters');
    expect(await screen.findByRole('heading', { name: 'Writable hero', level: 4 })).toBeInTheDocument();
    const canLead = await screen.findByRole('region', { name: 'Могу вести' });
    const canView = screen.getByRole('region', { name: 'Могу просматривать' });
    expect(within(canLead).getByRole('heading', { name: 'Writable hero', level: 4 })).toBeInTheDocument();
    expect(within(canLead).getByText('Можно вести и редактировать')).toBeInTheDocument();
    expect(within(canView).getByRole('heading', { name: 'Read only hero', level: 4 })).toBeInTheDocument();
    expect(within(canView).getByText('Только просмотр')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать персонажа' })).not.toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('keeps permission-pending characters out of readonly cards and empty states', async () => {
    let resolvePermissions!: (value: Response) => void;
    const pendingPermissions = new Promise<Response>(resolve => { resolvePermissions = resolve; });
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns') return response([campaign]);
      if (url === '/api/campaigns/12') return response(campaign);
      if (url === '/api/campaigns/12/permissions') return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url === '/api/campaigns/12/characters') return response([playerCharacters[0]]);
      if (url.endsWith(`${playerCharacters[0].id}/permissions`)) return pendingPermissions;
      throw new Error(`Unexpected request: ${url}`);
    });
    renderPilot(request, '/groups/12/player/characters');
    expect(await screen.findByText(`Загрузка прав персонажа «${playerCharacters[0].name}»…`)).toBeInTheDocument();
    expect(screen.queryByText('Только просмотр')).not.toBeInTheDocument();
    expect(screen.queryByText('Нет персонажей для ведения.')).not.toBeInTheDocument();
    expect(screen.queryByText('Нет персонажей только для просмотра.')).not.toBeInTheDocument();
    await act(async () => { resolvePermissions(response({ canRead: true, canWrite: false, canManageAccess: false })); });
    expect(await screen.findByRole('heading', { name: playerCharacters[0].name, level: 4 })).toBeInTheDocument();
  });

  it('filters locally, clears search, and renders a GM card with an explicit sheet action', async () => {
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/campaigns') return response([campaign]);
      if (url === '/api/campaigns/12') return response(campaign);
      if (url === '/api/campaigns/12/permissions') return response({ canRead: true, canWrite: true, canManageAccess: true });
      if (url === '/api/campaigns/12/characters') return response([playerCharacters[0]]);
      if (url.endsWith(`${playerCharacters[0].id}/permissions`)) return response({ canRead: true, canWrite: true, canManageAccess: false });
      throw new Error(`Unexpected request: ${url}`);
    });
    renderPilot(request, '/groups/12/gm/characters');
    const search = await screen.findByRole('textbox', { name: 'Поиск персонажей' });
    const article = await screen.findByRole('article');
    expect(within(article).getByRole('heading', { name: playerCharacters[0].name, level: 3 })).toBeInTheDocument();
    expect(within(article).getByRole('link', { name: `Открыть лист ${playerCharacters[0].name}` })).toHaveAttribute('href', `/tdn/groups/12/gm/characters/${playerCharacters[0].id}/overview`);
    expect(within(article).queryByRole('link', { name: playerCharacters[0].name })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'not found' } });
    expect(await screen.findByText('Совпадений нет.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }));
    expect(await screen.findByRole('heading', { name: playerCharacters[0].name, level: 3 })).toBeInTheDocument();
    expect(request.mock.calls.filter(([url]) => url === '/api/campaigns/12/characters')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Пространство игрока' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname')).toHaveTextContent('/groups/12/player/characters'));
    fireEvent.click(screen.getByRole('button', { name: 'Пространство мастера' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname')).toHaveTextContent('/groups/12/gm/overview'));
    expect(request.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });

  it('marks the campaign characters link active on a nested sheet route and preserves dirty creation draft on cancelled local navigation', async () => {
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/campaigns') return response([campaign]);
      if (url === '/api/campaigns/12') return response(campaign);
      if (url === '/api/campaigns/12/permissions') return response({ canRead: true, canWrite: true, canManageAccess: true });
      if (url === '/api/campaigns/12/characters') return response([playerCharacters[0]]);
      if (url === `/api/campaigns/12/characters/${playerCharacters[0].id}`) return response(playerCharacters[0]);
      if (url.endsWith(`${playerCharacters[0].id}/permissions`)) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url === `/api/campaigns/12/characters/${playerCharacters[0].id}/computed-sheet`) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [], formulaContentRevisions: [], virtualFields: [] });
      if (url === '/api/campaigns/12/presentation') return response({ contentRevision: 0, defaults: {}, contextParams: {} });
      throw new Error(`Unexpected request: ${url}`);
    });
    renderPilot(request, `/groups/12/gm/characters/${playerCharacters[0].id}/overview`);
    const nav = await screen.findByRole('navigation', { name: 'Разделы кампании' });
    const charactersLink = within(nav).getByRole('link', { name: 'Персонажи' });
    expect(charactersLink).toHaveAttribute('aria-current', 'page');
    fireEvent.click(within(nav).getByRole('link', { name: 'Персонажи' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname')).toHaveTextContent('/groups/12/gm/characters'));
    fireEvent.click(await screen.findByRole('button', { name: 'Создать персонажа' }));
    fireEvent.change(await screen.findByLabelText('Имя'), { target: { value: 'Unsaved hero' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(within(nav).getByRole('link', { name: 'Обзор' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText('Current pathname')).toHaveTextContent('/groups/12/gm/characters');
    expect(screen.getByLabelText('Имя')).toHaveValue('Unsaved hero');
    expect(request.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });
});
