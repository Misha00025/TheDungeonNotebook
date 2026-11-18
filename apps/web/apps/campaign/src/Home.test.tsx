import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import Home from './Home';
import App from './App';
import styles from './pages/Dashboard.module.css';
import { visitHistoryStorageKey } from './workspace/VisitHistory';
import type { HubRemoteProps } from '@tdn/shared';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const campaign = (id: number) => ({ id, name: `Campaign ${id}`, metadataRevision: 1 });
const character = (groupId: number, characterId: string, name = `Hero ${groupId}`) => ({ id: characterId, campaignId: groupId, name, importance: 'Key', metadataRevision: 1 });
const permissions = (canWrite: boolean) => ({ canRead: true, canWrite, canManageAccess: false });
const makeAuth = (request: (url: string, options?: RequestInit) => Promise<Response>, userId = 4) => ({ status: 'authenticated', authenticated: true, userId, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }) as unknown as HubRemoteProps['auth'];
const history = (lastVisitedGroupId: number | null, lastVisitedCharacters: { groupId: number; characterId: string }[]) => ({ lastVisitedGroupId, lastVisitedCharacters });
const renderHome = (request: (url: string, options?: RequestInit) => Promise<Response>, initial = '/groups', userId = 4) => render(<MemoryRouter initialEntries={[initial]}><Routes><Route path="/groups/*" element={<Home auth={makeAuth(request, userId)} />} /><Route path="*" element={<Home auth={makeAuth(request, userId)} />} /></Routes></MemoryRouter>);
const guidA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const guidB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('Home dashboard', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

  it('renders honest empty sections and keeps full campaign listing on the campaign route', async () => {
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns') return response([campaign(12)]);
      if (url === '/api/campaigns/12/permissions') return response(permissions(true));
      return response([]);
    });
    const home = renderHome(request);
    expect(await screen.findByRole('heading', { name: 'Последняя группа' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Последние персонажи' })).toBeInTheDocument();
    expect(screen.getByText('Быстрый доступ к последней просмотренной группе')).toBeInTheDocument();
    expect(screen.getByText('Быстрый доступ к последним просмотренным персонажам')).toBeInTheDocument();
    expect(screen.getByText('Посетите группы, чтобы они отображались здесь')).toBeInTheDocument();
    expect(screen.getByText('Посетите персонажа, чтобы они отображались здесь')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Перейти к группам' })).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'Создать кампанию' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Название')).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    home.unmount();

    render(<MemoryRouter initialEntries={['/groups']}><Routes><Route path="/groups/*" element={<App auth={makeAuth(request)} />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Кампании' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Играть' })).toHaveAttribute('href', '/groups/12/player/characters');
    expect(screen.getByRole('button', { name: 'Создать кампанию' })).toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url === '/api/campaigns')).toBe(true);
  });

  it('resolves stored history through campaign APIs and chooses mode from campaign permissions', async () => {
    window.localStorage.setItem(visitHistoryStorageKey('4'), JSON.stringify(history(12, [{ groupId: 13, characterId: guidA }, { groupId: 12, characterId: guidB }])));
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns/12') return response(campaign(12));
      if (url === '/api/campaigns/13') return response(campaign(13));
      if (url === '/api/campaigns/12/permissions') return response(permissions(false));
      if (url === '/api/campaigns/13/permissions') return response(permissions(true));
      if (url === `/api/campaigns/13/characters/${guidA}`) return response(character(13, guidA, 'Recent A'));
      if (url === `/api/campaigns/13/characters/${guidA}/permissions`) return response(permissions(false));
      if (url === `/api/campaigns/12/characters/${guidB}`) return response(character(12, guidB, 'Recent B'));
      if (url === `/api/campaigns/12/characters/${guidB}/permissions`) return response(permissions(true));
      throw new Error(`Unexpected request: ${url}`);
    });
    renderHome(request);
    expect(await screen.findByRole('link', { name: 'Продолжить кампанию' })).toHaveAttribute('href', '/groups/12/player/characters');
    await waitFor(() => expect(screen.getAllByRole('link', { name: /^Открыть персонажа/ })).toHaveLength(2));
    const orderedCharacterLinks = screen.getAllByRole('link', { name: /^Открыть персонажа/ });
    expect(orderedCharacterLinks[0]).toHaveAttribute('href', `/groups/13/gm/characters/${guidA}/overview`);
    expect(orderedCharacterLinks[1]).toHaveAttribute('href', `/groups/12/player/characters/${guidB}/overview`);
    const groupCard = screen.getByRole('link', { name: 'Продолжить кампанию' });
    expect(groupCard.querySelector(`.${styles.avatarPlaceholder}`)).toHaveTextContent('G');
    expect(groupCard.querySelector(`.${styles.info} h3`)).toHaveTextContent('Campaign 12');
    expect(groupCard.querySelector(`.${styles.action}`)).toHaveTextContent('→');
    const firstCard = orderedCharacterLinks[0];
    expect(firstCard.querySelector(`.${styles.avatarPlaceholder}`)).toHaveTextContent('C');
    expect(firstCard.querySelector(`.${styles.info} h3`)).toHaveTextContent('Recent A');
    expect(firstCard.querySelector(`.${styles.info} p`)).toHaveTextContent('Campaign 13');
    expect(firstCard.querySelector(`.${styles.action}`)).toHaveTextContent('→');
    expect(orderedCharacterLinks[1].querySelector(`.${styles.info} h3`)).toHaveTextContent('Recent B');
    expect(screen.getByText('Campaign 13')).toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => /list|computed-sheet|template|formulas|content/.test(url))).toBe(false);
  });

  it('keeps failed visit IDs, renders per-card errors, retries, and does not request numeric legacy character IDs', async () => {
    window.localStorage.setItem('lastVisitedGroupId', '12');
    const legacyCharacters = JSON.stringify([{ groupId: 12, characterId: 987 }]);
    window.localStorage.setItem('lastVisitedCharacters', legacyCharacters);
    window.localStorage.setItem(visitHistoryStorageKey('4'), JSON.stringify(history(12, [{ groupId: 13, characterId: guidA }, { groupId: 13, characterId: guidB }])));
    let failCharacter = true;
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns/12') return response({ code: 'not_found', title: 'Not found', detail: 'Gone' }, 404);
      if (url === '/api/campaigns/12/permissions') return response(permissions(true));
      if (url === '/api/campaigns/13') return response(campaign(13));
      if (url === '/api/campaigns/13/permissions') return response(permissions(true));
      if (url === `/api/campaigns/13/characters/${guidA}`) return failCharacter ? response({ code: 'dependency_unavailable', title: 'Unavailable', detail: 'Try again' }, 503) : response(character(13, guidA, 'Recovered'));
      if (url === `/api/campaigns/13/characters/${guidA}/permissions`) return response(permissions(true));
      if (url === `/api/campaigns/13/characters/${guidB}`) return response(character(13, guidB, 'Still available'));
      if (url === `/api/campaigns/13/characters/${guidB}/permissions`) return response(permissions(true));
      throw new Error(`Unexpected request: ${url}`);
    });
    renderHome(request);
    expect(await screen.findByText('Последняя группа недоступна.')).toBeInTheDocument();
    expect(await screen.findByText('Still available')).toBeInTheDocument();
    expect(await screen.findByText('Зависимый сервис временно недоступен.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Try again');
    expect(document.body.textContent).not.toContain('dependency_unavailable');
    expect(document.body.textContent).not.toContain('Unavailable');
    expect(screen.getByRole('link', { name: 'Открыть персонажа Still available' })).toHaveAttribute('href', `/groups/13/gm/characters/${guidB}/overview`);
    expect(request.mock.calls.some(([url]) => url.includes('/characters/987'))).toBe(false);
    expect(window.localStorage.getItem('lastVisitedCharacters')).toBe(legacyCharacters);
    failCharacter = false;
    fireEvent.click(screen.getAllByRole('button', { name: 'Повторить загрузку' })[1]);
    expect(await screen.findByText('Recovered')).toBeInTheDocument();
    expect(window.localStorage.getItem(visitHistoryStorageKey('4'))).toContain(guidA);
  });

  it.each([403, 404])('marks a character unavailable for permission or missing-resource status %s without hiding other visits', async status => {
    const saved = JSON.stringify(history(12, [{ groupId: 12, characterId: guidA }, { groupId: 12, characterId: guidB }]));
    window.localStorage.setItem(visitHistoryStorageKey('4'), saved);
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns/12') return response(campaign(12));
      if (url === '/api/campaigns/12/permissions') return response(permissions(true));
      if (url === `/api/campaigns/12/characters/${guidA}`) return response({ code: status === 403 ? 'forbidden' : 'not_found', title: 'Unavailable', detail: 'Unavailable' }, status);
      if (url === `/api/campaigns/12/characters/${guidA}/permissions`) return response(permissions(true));
      if (url === `/api/campaigns/12/characters/${guidB}`) return response(character(12, guidB, 'Available character'));
      if (url === `/api/campaigns/12/characters/${guidB}/permissions`) return response(permissions(true));
      throw new Error(`Unexpected request: ${url}`);
    });
    renderHome(request);
    expect(await screen.findByText('Персонаж или кампания недоступны.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Повторить загрузку' }).length).toBeGreaterThan(0);
    expect(await screen.findByText('Available character')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть персонажа Available character' })).toHaveAttribute('href', `/groups/12/gm/characters/${guidB}/overview`);
    expect(window.localStorage.getItem(visitHistoryStorageKey('4'))).toBe(saved);
  });

  it('does not expose a character link while its permissions are pending', async () => {
    window.localStorage.setItem(visitHistoryStorageKey('4'), JSON.stringify(history(12, [{ groupId: 12, characterId: guidA }])));
    let resolvePermissions!: (value: Response) => void;
    const pending = new Promise<Response>(resolve => { resolvePermissions = resolve; });
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns/12') return response(campaign(12));
      if (url === '/api/campaigns/12/permissions') return response(permissions(true));
      if (url === `/api/campaigns/12/characters/${guidA}`) return response(character(12, guidA));
      if (url === `/api/campaigns/12/characters/${guidA}/permissions`) return pending;
      throw new Error(`Unexpected request: ${url}`);
    });
    renderHome(request);
    await screen.findByText('Загрузка персонажа…');
    expect(screen.queryByRole('link', { name: /^Открыть персонажа/ })).not.toBeInTheDocument();
    await act(async () => { resolvePermissions(response(permissions(false))); });
    expect(await screen.findByRole('link', { name: `Открыть персонажа Hero 12` })).toHaveAttribute('href', `/groups/12/gm/characters/${guidA}/overview`);
  });

  it('switches account history without exposing the previous account after an in-flight read resolves', async () => {
    window.localStorage.setItem(visitHistoryStorageKey('4'), JSON.stringify(history(12, [])));
    window.localStorage.setItem(visitHistoryStorageKey('5'), JSON.stringify(history(13, [])));
    let resolveOldCampaign!: (value: Response) => void;
    const oldCampaign = new Promise<Response>(resolve => { resolveOldCampaign = resolve; });
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns/12') return oldCampaign;
      if (url === '/api/campaigns/12/permissions') return response(permissions(true));
      if (url === '/api/campaigns/13') return response(campaign(13));
      if (url === '/api/campaigns/13/permissions') return response(permissions(false));
      throw new Error(`Unexpected request: ${url}`);
    });
    const makeTree = (userId: number) => <MemoryRouter initialEntries={['/groups']}><Routes><Route path="/groups/*" element={<Home auth={makeAuth(request, userId)} />} /></Routes></MemoryRouter>;
    const mounted = render(makeTree(4));
    expect(await screen.findByText('Загрузка группы…')).toBeInTheDocument();
    mounted.rerender(makeTree(5));
    expect(await screen.findByRole('link', { name: 'Продолжить кампанию' })).toHaveAttribute('href', '/groups/13/player/characters');
    await act(async () => { resolveOldCampaign(response({ ...campaign(12), name: 'Old account campaign' })); });
    expect(screen.queryByText('Old account campaign')).not.toBeInTheDocument();
    expect(screen.getByText('Campaign 13')).toBeInTheDocument();
  });

  it('records real campaign and character visits and shows them after navigating home', async () => {
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns') return response([campaign(12)]);
      if (url === '/api/campaigns/12') return response(campaign(12));
      if (url === '/api/campaigns/12/permissions') return response(permissions(true));
      if (url === `/api/campaigns/12/characters/${guidA}`) return response(character(12, guidA, 'Visited Hero'));
      if (url === `/api/campaigns/12/characters/${guidA}/permissions`) return response(permissions(true));
      if (url === `/api/campaigns/12/characters/${guidA}/computed-sheet`) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [], virtualFields: [], formulaContentRevisions: [] });
      if (url === '/api/campaigns/12/characters') return response([character(12, guidA, 'Visited Hero')]);
      if (url === '/api/campaigns/12/presentation') return response({ contentRevision: 0, defaults: {}, contextParams: {} });
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter initialEntries={[`/groups/12/gm/characters/${guidA}/stats`]}><Link to="/">Home route</Link><Routes><Route path="/groups/*" element={<App auth={makeAuth(request)} />} /><Route path="*" element={<Home auth={makeAuth(request)} />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Visited Hero' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Home route' }));
    expect(await screen.findByRole('heading', { name: 'Последняя группа' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Продолжить кампанию' })).toHaveAttribute('href', '/groups/12/gm/overview');
    expect(await screen.findByRole('link', { name: 'Открыть персонажа Visited Hero' })).toHaveAttribute('href', `/groups/12/gm/characters/${guidA}/overview`);
    expect(JSON.parse(window.localStorage.getItem(visitHistoryStorageKey('4'))!)).toEqual(history(12, [{ groupId: 12, characterId: guidA }]));
  });

  it('does not record a character whose permission request fails', async () => {
    const request = vi.fn(async (url: string) => {
      if (url === '/api/campaigns') return response([campaign(12)]);
      if (url === '/api/campaigns/12') return response(campaign(12));
      if (url === '/api/campaigns/12/permissions') return response(permissions(true));
      if (url === `/api/campaigns/12/characters/${guidA}`) return response(character(12, guidA));
      if (url === `/api/campaigns/12/characters/${guidA}/permissions`) return response({ code: 'forbidden', title: 'Forbidden', detail: 'Denied' }, 403);
      if (url === `/api/campaigns/12/characters/${guidA}/computed-sheet`) return response({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [], virtualFields: [], formulaContentRevisions: [] });
      if (url === '/api/campaigns/12/characters') return response([character(12, guidA)]);
      if (url === '/api/campaigns/12/presentation') return response({ contentRevision: 0, defaults: {}, contextParams: {} });
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter initialEntries={[`/groups/12/gm/characters/${guidA}/stats`]}><Link to="/">Home route</Link><Routes><Route path="/groups/*" element={<App auth={makeAuth(request)} />} /><Route path="*" element={<Home auth={makeAuth(request)} />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Доступ запрещён.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Home route' }));
    expect(await screen.findByRole('heading', { name: 'Последняя группа' })).toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(visitHistoryStorageKey('4'))!)).toEqual(history(12, [])));
  });
});
