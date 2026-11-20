import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { HubRemoteProps } from '@tdn/shared';
import App from './App';
import { CampaignApiError } from './workspace/api';
import { ApiError } from './workspace/Feedback';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const campaign = { id: 12, name: 'Pilot campaign', metadataRevision: 1 };
const presentation = { contentRevision: 1, defaults: { page_1: 'view-one', page_2: 'view-two' }, contextParams: { page_1: { title: 'Основное' }, page_2: { title: 'Дополнительно' } } };
const resolved = (key: string) => ({ contextKey: key, viewMetadata: { id: key, key, campaignId: 12, name: key, metadataRevision: 1 }, viewContent: { campaignId: 12, resourceId: key, contentRevision: 1, data: { roots: [] } }, contextParams: null, contentRevision: 1 });
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
const playerCharacters = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', campaignId: 12, name: 'Writable hero', importance: 'Key', metadataRevision: 1 },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', campaignId: 12, name: 'Read only hero', importance: 'Background', metadataRevision: 1 },
  { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', campaignId: 12, name: 'Second writable hero', importance: 'Secondary', metadataRevision: 1 },
  { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', campaignId: 12, name: 'Second readonly hero', importance: 'Background', metadataRevision: 1 },
];
const makeAuth = (request: (url: string, options?: RequestInit) => Promise<Response>) => ({ status: 'authenticated', authenticated: true, userId: 4, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }) as unknown as HubRemoteProps['auth'];
const CurrentPath: React.FC = () => <output aria-label="Current pathname">{useLocation().pathname}</output>;
const renderPilot = (request: (url: string, options?: RequestInit) => Promise<Response>, initial: string, basename = '/tdn') => render(
  <MemoryRouter basename={basename || undefined} initialEntries={[`${basename}${initial}`]}>
    <Routes><Route path="/groups/*" element={<App auth={makeAuth(request)} />} /></Routes>
    <CurrentPath />
  </MemoryRouter>
);

describe('campaign SDK pilot', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    else Reflect.deleteProperty(window, 'matchMedia');
  });

  it.each([
    [403, 'Доступ запрещён.'],
    [404, 'Ресурс не найден.'],
    [503, 'Зависимый сервис временно недоступен.'],
  ] as const)('preserves API error feedback for status %s', (status, message) => {
    render(<ApiError error={new CampaignApiError(status, { code: 'failure', title: 'Failure', detail: 'Details', errors: { 'private-field': ['raw validation'] } })} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(alert).not.toHaveTextContent('failure');
    expect(alert).not.toHaveTextContent('Details');
    expect(alert).not.toHaveTextContent('private-field');
    expect(alert).not.toHaveTextContent('raw validation');
  });

  it('shows player characters in independent permission groups without creation controls', async () => {
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/campaigns') return response([campaign]);
      if (url === '/api/campaigns/12') return response(campaign);
      if (url === '/api/campaigns/12/permissions') return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url === '/api/campaigns/12/characters') return response(playerCharacters);
      if (url.endsWith(`${playerCharacters[0].id}/permissions`)) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith(`${playerCharacters[1].id}/permissions`)) return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url.endsWith(`${playerCharacters[2].id}/permissions`)) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith(`${playerCharacters[3].id}/permissions`)) return response({ canRead: true, canWrite: false, canManageAccess: false });
      throw new Error(`Unexpected request: ${url}`);
    });
    renderPilot(request, '/groups/12/player/characters');
    expect(await screen.findByRole('heading', { name: 'Writable hero', level: 4 })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Second writable hero', level: 4 })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Read only hero', level: 4 })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Second readonly hero', level: 4 })).toBeInTheDocument();
    const canLead = await screen.findByRole('region', { name: 'Могу вести' });
    const canView = screen.getByRole('region', { name: 'Могу просматривать' });
    expect(within(canLead).getByRole('heading', { name: 'Writable hero', level: 4 })).toBeInTheDocument();
    expect(within(canLead).getByRole('heading', { name: 'Second writable hero', level: 4 })).toBeInTheDocument();
    expect(within(canView).getByRole('heading', { name: 'Read only hero', level: 4 })).toBeInTheDocument();
    expect(within(canView).getByRole('heading', { name: 'Second readonly hero', level: 4 })).toBeInTheDocument();
    expect(screen.queryByText('Можно вести и редактировать')).not.toBeInTheDocument();
    expect(screen.queryByText('Только просмотр')).not.toBeInTheDocument();
    expect(screen.queryByText('Права на каждого персонажа определяются отдельно.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать персонажа' })).not.toBeInTheDocument();
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
    await waitFor(() => expect(request.mock.calls.some(([url]) => url.endsWith(`${playerCharacters[0].id}/permissions`))).toBe(true));
    expect(screen.queryByRole('heading', { name: playerCharacters[0].name, level: 4 })).not.toBeInTheDocument();
    expect(screen.queryByText('Нет персонажей для ведения.')).not.toBeInTheDocument();
    expect(screen.queryByText('Нет персонажей только для просмотра.')).not.toBeInTheDocument();
    await act(async () => { resolvePermissions(response({ canRead: true, canWrite: false, canManageAccess: false })); });
    const canView = await screen.findByRole('region', { name: 'Могу просматривать' });
    expect(within(canView).getByRole('heading', { name: playerCharacters[0].name, level: 4 })).toBeInTheDocument();
  });

  it('filters locally, clears search, and renders functional GM character entries', async () => {
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/campaigns') return response([campaign]);
      if (url === '/api/campaigns/12') return response(campaign);
      if (url === '/api/campaigns/12/permissions') return response({ canRead: true, canWrite: true, canManageAccess: true });
      if (url === '/api/campaigns/12/characters') return response([playerCharacters[0]]);
      if (url === '/api/campaigns/12/formulas' || url === '/api/campaigns/12/views') return response([]);
      if (url.endsWith(`${playerCharacters[0].id}/permissions`)) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith(`/characters/${playerCharacters[0].id}/sheet`)) return response({ contentRevision: 1, templateContentRevision: 1, description: 'Pilot description', baseFields: [] });
      if (url.endsWith(`/characters/${playerCharacters[0].id}/assignments`)) return response([]);
      throw new Error(`Unexpected request: ${url}`);
    });
    renderPilot(request, '/groups/12/gm/characters');
    const search = await screen.findByRole('textbox', { name: 'Поиск персонажей' });
    const keyGroup = await screen.findByRole('region', { name: 'Ключевые' });
    const entry = within(keyGroup).getByRole('button', { name: `Открыть лист ${playerCharacters[0].name}` });
    expect(entry).toHaveTextContent(playerCharacters[0].name);
    expect(await within(entry).findByText('Pilot description')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'not found' } });
    expect(await screen.findByText('Совпадений нет.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }));
    const restoredKeyGroup = await screen.findByRole('region', { name: 'Ключевые' });
    expect(within(restoredKeyGroup).getByRole('button', { name: `Открыть лист ${playerCharacters[0].name}` })).toHaveTextContent('Pilot description');
    expect(request.mock.calls.filter(([url]) => url === '/api/campaigns/12/characters')).toHaveLength(1);
    fireEvent.change(screen.getByRole('combobox', { name: 'Окружение' }), { target: { value: 'player' } });
    await waitFor(() => expect(screen.getByLabelText('Current pathname')).toHaveTextContent('/groups/12/player/characters'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Окружение' }), { target: { value: 'gm' } });
    await waitFor(() => expect(screen.getByLabelText('Current pathname')).toHaveTextContent('/groups/12/gm/overview'));
    expect(request.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });

  it('marks the campaign characters link active on a nested sheet route and keeps a rejected modal close draft', async () => {
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/campaigns') return response([campaign]);
      if (url === '/api/campaigns/12') return response(campaign);
      if (url === '/api/campaigns/12/permissions') return response({ canRead: true, canWrite: true, canManageAccess: true });
      if (url === '/api/campaigns/12/characters') return response([playerCharacters[0]]);
      if (url === `/api/campaigns/12/characters/${playerCharacters[0].id}`) return response(playerCharacters[0]);
      if (url.endsWith(`${playerCharacters[0].id}/permissions`)) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url === `/api/campaigns/12/characters/${playerCharacters[0].id}/computed-sheet`) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [], formulaContentRevisions: [], virtualFields: [] });
      if (url === '/api/campaigns/12/presentation') return response(presentation);
      if (url.includes('/presentation/resolve?')) return response(resolved(new URL(url, 'http://localhost').searchParams.get('contextKey') ?? ''));
      throw new Error(`Unexpected request: ${url}`);
    });
    renderPilot(request, `/groups/12/gm/characters/${playerCharacters[0].id}/overview`);
    const nav = await screen.findByRole('navigation', { name: 'Разделы кампании' });
    const charactersLink = within(nav).getByRole('link', { name: 'Персонажи' });
    expect(charactersLink).toHaveAttribute('aria-current', 'page');
    fireEvent.click(within(nav).getByRole('link', { name: 'Персонажи' }));
    await waitFor(() => expect(screen.getByLabelText('Current pathname')).toHaveTextContent('/groups/12/gm/characters'));
    fireEvent.click(await screen.findByRole('button', { name: 'Создать персонажа' }));
    const dialog = await screen.findByRole('dialog', { name: 'Создать персонажа' });
    const name = within(dialog).getByLabelText('Имя');
    fireEvent.change(name, { target: { value: 'Unsaved hero' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    expect(confirm).toHaveBeenCalledWith('Отказаться от черновика персонажа?');
    expect(screen.getByRole('dialog', { name: 'Создать персонажа' })).toBeInTheDocument();
    expect(screen.getByLabelText('Current pathname')).toHaveTextContent('/groups/12/gm/characters');
    expect(name).toHaveValue('Unsaved hero');
    expect(request.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });

  it.each([
    { basename: '', prefix: '/groups' },
    { basename: '/tdn', prefix: '/tdn/groups' },
  ])('shows sheet-only mobile navigation with a scoped Back route under $basename', async ({ basename, prefix }) => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ media: query, matches: true, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }),
    });
    const characterId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns') return response([campaign]);
      if (url === '/api/campaigns/12') return response(campaign);
      if (url === '/api/campaigns/12/permissions') return response({ canRead: true, canWrite: true, canManageAccess: true });
      if (url === `/api/campaigns/12/characters/${characterId}`) return response({ ...playerCharacters[0], id: characterId });
      if (url === `/api/campaigns/12/characters/${characterId}/permissions`) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url === `/api/campaigns/12/characters/${characterId}/computed-sheet`) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [], formulaContentRevisions: [], virtualFields: [] });
      if (url === '/api/campaigns/12/characters') return response([]);
      if (url === '/api/campaigns/12/presentation') return response(presentation);
      if (url.includes('/presentation/resolve?')) return response(resolved(new URL(url, 'http://localhost').searchParams.get('contextKey') ?? ''));
      throw new Error(`Unexpected request: ${url}`);
    });
    renderPilot(request, `/groups/12/gm/characters/${characterId}/page_2`, basename);
    const navigation = await screen.findByRole('navigation', { name: 'Лист персонажа на телефоне' });
    const back = within(navigation).getByRole('link', { name: 'Назад' });
    expect(back).toHaveAttribute('href', `${prefix}/12/gm/characters`);
    fireEvent.click(back);
    await waitFor(() => expect(screen.getByLabelText('Current pathname')).toHaveTextContent('/groups/12/gm/characters'));
  });
});
