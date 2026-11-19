import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LosslessNumber } from 'lossless-json';
import Members from './Members';
import CampaignSettings from './CampaignSettings';

const api = vi.hoisted(() => ({ listMembers: vi.fn(), listCharacters: vi.fn(), characterPermissions: vi.fn(), listAssignments: vi.fn(), getUser: vi.fn(), searchUsers: vi.fn(), putMember: vi.fn(), deleteMember: vi.fn(), putAssignment: vi.fn(), deleteAssignment: vi.fn(), renameCampaign: vi.fn(), getCampaign: vi.fn() }));
const context = vi.hoisted(() => ({ invalidation: 0, notifyInvalidation: vi.fn(), sessionKey: '7', permissionsLoading: false }));
let campaignPermissions = { canWrite: true, canManageAccess: true, canRead: true };
let campaign = { id: 4, name: 'Original', metadataRevision: 3 };

vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, ...context }), useDirtyDraft: () => vi.fn(), useDirtyState: () => false }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ campaign, permissions: campaignPermissions, lastKnownPermissions: campaignPermissions, permissionsLoading: context.permissionsLoading, mode: 'gm', reloadCampaign: vi.fn() }) }));

const heroId = 'abcdef01-2345-6789-abcd-ef0123456789';
const miraId = '12345678-abcd-1234-abcd-123456789abc';
const member = { campaignId: 4, userId: 21, isAdmin: false, metadataRevision: 8 };
const sibling = { campaignId: 4, userId: 22, isAdmin: false, metadataRevision: 14 };
const hero = { id: heroId, campaignId: 4, name: 'Hero', importance: 'Key' as const, metadataRevision: 4 };
const mira = { id: miraId, campaignId: 4, name: 'Mira', importance: 'Background' as const, metadataRevision: 7 };
const assignment = { campaignId: 4, characterId: heroId, userId: 21, canWrite: false, metadataRevision: 11 };
const siblingAssignment = { campaignId: 4, characterId: miraId, userId: 22, canWrite: true, metadataRevision: 19 };
const user = { id: 21, nickname: 'alice', visibleName: 'Alice' };
const otherUser = { id: 22, nickname: 'bea', visibleName: 'Bea' };
const setupApi = () => {
  Object.values(api).forEach(method => method.mockReset());
  context.invalidation = 0; context.notifyInvalidation.mockReset(); context.sessionKey = '7'; context.permissionsLoading = false;
  api.listMembers.mockResolvedValue([member]); api.listCharacters.mockResolvedValue([hero, mira]);
  api.characterPermissions.mockResolvedValue({ canRead: true, canWrite: true, canManageAccess: true });
  api.listAssignments.mockImplementation(async (_campaignId: number, id: string) => id === heroId ? [assignment] : []);
  api.getUser.mockImplementation(async (id: number) => id === 21 ? user : id === 22 ? otherUser : { id, nickname: 'newbie', visibleName: 'Newbie' });
  api.searchUsers.mockResolvedValue([]);
  api.putMember.mockImplementation(async (_id: number, userId: number, body: { isAdmin: boolean }) => ({ campaignId: 4, userId, isAdmin: body.isAdmin, metadataRevision: 9 }));
  api.deleteMember.mockResolvedValue(undefined); api.putAssignment.mockImplementation(async (_id: number, id: string, userId: number, body: { canWrite: boolean }) => ({ campaignId: 4, characterId: id, userId, canWrite: body.canWrite, metadataRevision: 12 })); api.deleteAssignment.mockResolvedValue(undefined);
  api.getCampaign.mockResolvedValue({ ...campaign, name: 'Latest', metadataRevision: 4 });
  api.renameCampaign.mockResolvedValue({ ...campaign, name: 'Renamed', metadataRevision: 4 });
  campaignPermissions = { canWrite: true, canManageAccess: true, canRead: true };
  campaign = { id: 4, name: 'Original', metadataRevision: 3 };
};
const renderAt = (element: React.ReactNode, path: string) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path=":groupId/gm/members" element={element} /><Route path=":groupId/gm/settings" element={element} /></Routes></MemoryRouter>);
const waitForMembersReady = (name = 'Alice') => waitFor(() => expect(screen.getByRole('button', { name: `Назначить персонажа ${name}` })).toBeEnabled());
const searchFor = async (query: string, results: { id: number; nickname: string; visibleName: string }[]) => {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Найти' })).toBeEnabled());
  api.searchUsers.mockResolvedValueOnce(results);
  fireEvent.change(screen.getByLabelText('Никнейм'), { target: { value: query } });
  fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
  if (results.length === 0) await screen.findByText('Ничего не найдено.');
  else await screen.findAllByRole('button', { name: /Добавить участника/ });
};
const rowNamed = (name: string) => screen.getByRole('row', { name: `Участник ${name}` });

describe('campaign members access', () => {
  beforeEach(setupApi);
  afterEach(() => vi.restoreAllMocks());

  it('does not load membership or assignments when campaign access management is denied', async () => {
    campaignPermissions = { canWrite: true, canManageAccess: false, canRead: true };
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText('Список членства доступен только управляющим доступом.');
    expect(api.listMembers).not.toHaveBeenCalled();
    expect(api.listAssignments).not.toHaveBeenCalled();
  });

  it('checks each character permission before its assignment list and keeps allowed characters independent', async () => {
    api.characterPermissions.mockImplementation(async (_id: number, id: string) => ({ canRead: true, canWrite: true, canManageAccess: id === heroId }));
    api.listAssignments.mockResolvedValue([assignment]);
    renderAt(<Members />, '/4/gm/members');
    await screen.findByRole('row', { name: 'Участник Alice' });
    expect(await screen.findByText('Не все назначения доступны.')).toBeInTheDocument();
    expect(api.listAssignments).toHaveBeenCalledTimes(1);
    expect(api.listAssignments).toHaveBeenCalledWith(4, heroId);
    expect(await within(rowNamed('Alice')).findByText('Hero')).toBeInTheDocument();
    expect(within(rowNamed('Alice')).queryByText('Список назначений неполон.')).not.toBeInTheDocument();
    expect(screen.queryByText('Персонажи не назначены.')).not.toBeInTheDocument();
  });

  it('keeps list failures distinct from an empty member or assignment list and retries reads', async () => {
    api.listMembers.mockRejectedValueOnce(new Error('private detail'));
    api.listCharacters.mockResolvedValue([]);
    renderAt(<Members />, '/4/gm/members');
    await screen.findByRole('button', { name: 'Повторить загрузку' });
    expect(screen.queryByText('Участников нет.')).not.toBeInTheDocument();
    expect(screen.queryByText('Персонажи не назначены.')).not.toBeInTheDocument();
    expect(screen.queryByText('private detail')).not.toBeInTheDocument();
  });

  it('keeps known assignments visible and summarizes a partial assignment read', async () => {
    api.listAssignments.mockImplementation(async (_id: number, id: string) => id === heroId ? [assignment] : Promise.reject(new Error('private detail')));
    renderAt(<Members />, '/4/gm/members');
    await screen.findByRole('row', { name: 'Участник Alice' });
    expect(await within(rowNamed('Alice')).findByText('Hero')).toBeInTheDocument();
    expect(await screen.findByText('Не все назначения доступны.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить загрузку назначений' })).toBeInTheDocument();
    expect(within(rowNamed('Alice')).queryByText('Список назначений неполон.')).not.toBeInTheDocument();
    expect(screen.queryByText('Персонажи не назначены.')).not.toBeInTheDocument();
    expect(screen.queryByText('private detail')).not.toBeInTheDocument();
  });

  it('uses one combined warning when profile and assignment reads both fail', async () => {
    api.getUser.mockRejectedValueOnce(new Error('private profile detail'));
    api.listAssignments.mockImplementation(async (_id: number, id: string) => id === heroId ? Promise.reject(new Error('private assignment detail')) : []);
    renderAt(<Members />, '/4/gm/members');
    expect(await screen.findByText('Не все данные списка участников доступны.')).toBeInTheDocument();
    expect(screen.queryByText('Не все профили доступны.')).not.toBeInTheDocument();
    expect(screen.queryByText('Не все назначения доступны.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить загрузку профилей' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить загрузку назначений' })).toBeInTheDocument();
    expect(screen.queryByText('Загрузка профиля…')).not.toBeInTheDocument();
    expect(screen.queryByText('Загрузка доступа персонажа')).not.toBeInTheDocument();
  });

  it('uses one list-section loading notification until both profiles and character access reads settle', async () => {
    const profileResolvers = new Map<number, (value: typeof user) => void>();
    const permissionResolvers = new Map<string, (value: typeof campaignPermissions) => void>();
    api.listMembers.mockResolvedValue([member, sibling]);
    api.getUser.mockImplementation((id: number) => new Promise(resolve => { profileResolvers.set(id, resolve); }));
    api.characterPermissions.mockImplementation((_id: number, id: string) => new Promise(resolve => { permissionResolvers.set(id, resolve); }));
    api.listAssignments.mockImplementation(async (_id: number, id: string) => id === heroId ? [assignment] : [siblingAssignment]);
    renderAt(<Members />, '/4/gm/members');
    expect(await screen.findAllByRole('row', { name: 'Участник Участник' })).toHaveLength(2);
    await waitFor(() => expect(profileResolvers.size).toBe(2));
    await waitFor(() => expect(permissionResolvers.size).toBe(2));
    expect(screen.getByRole('table', { name: 'Участники кампании' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('status').filter(node => /Загрузка…|Обработка…/.test(node.textContent ?? ''))).toHaveLength(1);
    expect(screen.queryByText(/Загрузка профиля|Загрузка доступа персонажа|Загрузка участников/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Повысить Участник до ГМ' }).every(button => (button as HTMLButtonElement).disabled)).toBe(true);
    profileResolvers.get(21)?.(user);
    await screen.findByText('Alice (@alice)');
    expect(screen.getByRole('table', { name: 'Участники кампании' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Повысить Alice до ГМ' })).toBeDisabled();
    permissionResolvers.get(heroId)?.({ canRead: true, canWrite: true, canManageAccess: true });
    await waitFor(() => expect(api.listAssignments).toHaveBeenCalledWith(4, heroId));
    expect(screen.getByRole('table', { name: 'Участники кампании' })).toHaveAttribute('aria-busy', 'true');
    permissionResolvers.get(miraId)?.({ canRead: true, canWrite: true, canManageAccess: true });
    await waitFor(() => expect(api.listAssignments).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('table', { name: 'Участники кампании' })).toHaveAttribute('aria-busy', 'true');
    profileResolvers.get(22)?.(otherUser);
    await waitFor(() => expect(screen.getByRole('table', { name: 'Участники кампании' })).not.toHaveAttribute('aria-busy', 'true'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Повысить Alice до ГМ' })).toBeEnabled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('loads profiles separately, uses safe fallback and retries profile errors', async () => {
    api.getUser.mockRejectedValueOnce(new Error('private profile detail')).mockResolvedValue(user);
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText('Профиль недоступен');
    expect(screen.queryByText('private profile detail')).not.toBeInTheDocument();
    expect(await screen.findByText('Не все профили доступны.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку профилей' }));
    expect(await screen.findByRole('row', { name: 'Участник Alice' })).toBeInTheDocument();
    expect(api.getUser).toHaveBeenCalledTimes(2);
  });

  it('shows signed search results as cards and adds only after the explicit action', async () => {
    renderAt(<Members />, '/4/gm/members');
    await screen.findByRole('row', { name: 'Участник Alice' });
    await waitForMembersReady();
    await searchFor('bob', [{ id: -32, nickname: 'bob', visibleName: 'Bob' }, { id: 21, nickname: 'alice', visibleName: 'Alice' }]);
    expect(api.searchUsers).toHaveBeenCalledWith('bob');
    expect(screen.getByText('Bob (@bob)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Найденный пользователь')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить участника Bob' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Добавить участника Alice' })).toBeDisabled();
    expect(api.putMember).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Добавить участника Bob' }));
    await waitFor(() => expect(api.putMember).toHaveBeenCalledWith(4, -32, { isAdmin: false, expectedRevision: 0 }));
    expect(await screen.findByRole('row', { name: 'Участник Newbie' })).toBeInTheDocument();
    await waitForMembersReady('Newbie');
    expect(screen.getByRole('row', { name: 'Участник Alice' })).toBeInTheDocument();
    expect(screen.queryByText('-32')).not.toBeInTheDocument();
  });

  it('ignores an older search response after the query changes', async () => {
    let resolveOld!: (users: { id: number; nickname: string; visibleName: string }[]) => void;
    api.searchUsers.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce([{ id: 32, nickname: 'new', visibleName: 'New' }]);
    renderAt(<Members />, '/4/gm/members');
    await screen.findByRole('row', { name: 'Участник Alice' });
    await waitForMembersReady();
    fireEvent.change(screen.getByLabelText('Никнейм'), { target: { value: 'old' } });
    fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
    fireEvent.change(screen.getByLabelText('Никнейм'), { target: { value: 'new' } });
    fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
    expect(await screen.findByText('New (@new)')).toBeInTheDocument();
    resolveOld([{ id: 33, nickname: 'old', visibleName: 'Old' }]);
    await waitFor(() => expect(screen.queryByText('Old (@old)')).not.toBeInTheDocument());
    expect(api.putMember).not.toHaveBeenCalled();
  });

  it('distinguishes an empty search from a safe search error and permits a new query', async () => {
    renderAt(<Members />, '/4/gm/members');
    await waitForMembersReady();
    await searchFor('missing', []);
    expect(screen.getByText('Ничего не найдено.')).toBeInTheDocument();
    api.searchUsers.mockRejectedValueOnce(new Error('private search detail')).mockResolvedValueOnce([{ id: 32, nickname: 'new', visibleName: 'New' }]);
    fireEvent.change(screen.getByLabelText('Никнейм'), { target: { value: 'broken' } });
    fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
    expect(await screen.findByText('Не удалось выполнить операцию. Попробуйте ещё раз.')).toBeInTheDocument();
    expect(screen.queryByText('private search detail')).not.toBeInTheDocument();
    await searchFor('new', [{ id: 32, nickname: 'new', visibleName: 'New' }]);
    expect(screen.getByText('New (@new)')).toBeInTheDocument();
  });

  it('does not merge a response from a previous session into the keyed page', async () => {
    let resolvePrevious!: (rows: Array<typeof member>) => void;
    api.listMembers.mockImplementationOnce(() => new Promise(resolve => { resolvePrevious = resolve; })).mockResolvedValueOnce([sibling]);
    const view = renderAt(<Members />, '/4/gm/members');
    context.sessionKey = '8';
    view.rerender(<MemoryRouter initialEntries={['/4/gm/members']}><Routes><Route path=":groupId/gm/members" element={<Members />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('row', { name: 'Участник Bea' })).toBeInTheDocument();
    resolvePrevious([member]);
    await waitFor(() => expect(screen.queryByRole('row', { name: 'Участник Alice' })).not.toBeInTheDocument());
    expect(api.listMembers).toHaveBeenCalledTimes(2);
  });

  it('does not start assignment-list requests after campaign display rights are revoked', async () => {
    let resolveRights!: (value: typeof campaignPermissions) => void;
    api.listCharacters.mockResolvedValue([hero]);
    api.characterPermissions.mockImplementationOnce(() => new Promise(resolve => { resolveRights = resolve; }));
    const view = renderAt(<Members />, '/4/gm/members');
    await waitFor(() => expect(api.listMembers).toHaveBeenCalledWith(4));
    campaignPermissions = { canWrite: false, canManageAccess: false, canRead: true };
    view.rerender(<MemoryRouter initialEntries={['/4/gm/members']}><Routes><Route path=":groupId/gm/members" element={<Members />} /></Routes></MemoryRouter>);
    resolveRights({ canRead: true, canWrite: true, canManageAccess: true });
    await screen.findByText('Список членства доступен только управляющим доступом.');
    expect(api.listAssignments).not.toHaveBeenCalled();
  });

  it('checks an uncertain member insertion, recognizes presence and never repeats the insert', async () => {
    const added = { campaignId: 4, userId: 31, isAdmin: false, metadataRevision: 1 };
    api.searchUsers.mockResolvedValue([{ id: 31, nickname: 'newbie', visibleName: 'Newbie' }]);
    api.putMember.mockRejectedValueOnce({ unknownOutcome: true });
    api.listMembers.mockResolvedValueOnce([member]).mockResolvedValueOnce([member, added]);
    renderAt(<Members />, '/4/gm/members');
    await screen.findByRole('row', { name: 'Участник Alice' });
    await waitForMembersReady();
    await searchFor('newbie', [{ id: 31, nickname: 'newbie', visibleName: 'Newbie' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить участника Newbie' }));
    const verify = await screen.findByRole('button', { name: 'Проверить добавление участника' });
    fireEvent.click(verify);
    expect(await screen.findByRole('row', { name: 'Участник Newbie' })).toBeInTheDocument();
    await waitForMembersReady('Newbie');
    expect(screen.getByRole('row', { name: 'Участник Alice' })).toBeInTheDocument();
    expect(api.putMember).toHaveBeenCalledTimes(1);
  });

  it('unblocks an uncertain member insertion only after a successful absence check', async () => {
    const added = { campaignId: 4, userId: -31, isAdmin: false, metadataRevision: 1 };
    api.putMember.mockRejectedValueOnce({ unknownOutcome: true }).mockResolvedValueOnce(added);
    api.listMembers.mockResolvedValueOnce([member]).mockResolvedValueOnce([member]);
    renderAt(<Members />, '/4/gm/members');
    await screen.findByRole('row', { name: 'Участник Alice' });
    await waitForMembersReady();
    await searchFor('newbie', [{ id: -31, nickname: 'newbie', visibleName: 'Newbie' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить участника Newbie' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Проверить добавление участника' }));
    await waitFor(() => expect(screen.queryByText('Результат добавления участника не подтверждён.')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Добавить участника Newbie' }));
    await waitFor(() => expect(api.putMember).toHaveBeenCalledTimes(2));
    expect(api.putMember).toHaveBeenLastCalledWith(4, -31, { isAdmin: false, expectedRevision: 0 });
    expect(await screen.findByRole('row', { name: 'Участник Newbie' })).toBeInTheDocument();
    await waitForMembersReady('Newbie');
    expect(screen.getByRole('row', { name: 'Участник Alice' })).toBeInTheDocument();
  });

  it('allows explicit retry after a known member insertion failure and discard releases the insert target', async () => {
    api.putMember.mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce({ campaignId: 4, userId: 32, isAdmin: false, metadataRevision: 1 });
    renderAt(<Members />, '/4/gm/members');
    await waitForMembersReady();
    await searchFor('new', [{ id: 32, nickname: 'new', visibleName: 'New' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить участника New' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Отказаться' }));
    expect(api.putMember).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Добавить участника New' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Добавить участника New' }));
    await waitFor(() => expect(api.putMember).toHaveBeenCalledTimes(2));
    expect(api.putMember).toHaveBeenLastCalledWith(4, 32, { isAdmin: false, expectedRevision: 0 });
    expect(await screen.findByRole('row', { name: 'Участник Newbie' })).toBeInTheDocument();
    await waitForMembersReady('Newbie');
    expect(screen.getByRole('row', { name: 'Участник Alice' })).toBeInTheDocument();
  });

  it('keeps every existing member and their assignments when an added member succeeds', async () => {
    const newMember = { campaignId: 4, userId: 31, isAdmin: false, metadataRevision: 1 };
    api.listMembers.mockResolvedValue([member, sibling]);
    api.listAssignments.mockImplementation(async (_id: number, id: string) => id === heroId ? [assignment] : [siblingAssignment]);
    api.putMember.mockResolvedValue(newMember);
    renderAt(<Members />, '/4/gm/members');
    await screen.findByRole('row', { name: 'Участник Alice' });
    await screen.findByRole('row', { name: 'Участник Bea' });
    await waitForMembersReady();
    await searchFor('newbie', [{ id: 31, nickname: 'newbie', visibleName: 'Newbie' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить участника Newbie' }));
    expect(await screen.findByRole('row', { name: 'Участник Newbie' })).toBeInTheDocument();
    expect(within(rowNamed('Alice')).getByText('Hero')).toBeInTheDocument();
    expect(within(rowNamed('Bea')).getByText('Mira')).toBeInTheDocument();
  });

  it('promotes and demotes directly with the last confirmed member revision', async () => {
    api.putMember.mockResolvedValueOnce({ ...member, isAdmin: true, metadataRevision: 9 }).mockResolvedValueOnce({ ...member, isAdmin: false, metadataRevision: 10 });
    renderAt(<Members />, '/4/gm/members');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Повысить Alice до ГМ' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Повысить Alice до ГМ' }));
    await screen.findByRole('img', { name: 'Гейм-мастер' });
    expect(api.putMember).toHaveBeenNthCalledWith(1, 4, 21, { isAdmin: true, expectedRevision: 8 });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Понизить Alice до игрока' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Понизить Alice до игрока' }));
    await waitFor(() => expect(api.putMember).toHaveBeenNthCalledWith(2, 4, 21, { isAdmin: false, expectedRevision: 9 }));
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Гейм-мастер' })).not.toBeInTheDocument());
  });

  it('uses the acknowledged role revision after a stale list snapshot arrives', async () => {
    const losslessRevision = new LosslessNumber('9007199254740993');
    const exactMember = { ...member, metadataRevision: losslessRevision };
    api.listMembers.mockResolvedValue([exactMember]);
    api.putMember.mockResolvedValueOnce({ ...exactMember, isAdmin: true, metadataRevision: new LosslessNumber('9007199254740994') }).mockResolvedValueOnce({ ...exactMember, isAdmin: false, metadataRevision: new LosslessNumber('9007199254740995') });
    const view = renderAt(<Members />, '/4/gm/members');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Повысить Alice до ГМ' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Повысить Alice до ГМ' }));
    await screen.findByRole('img', { name: 'Гейм-мастер' });
    context.invalidation += 1;
    view.rerender(<MemoryRouter initialEntries={['/4/gm/members']}><Routes><Route path=":groupId/gm/members" element={<Members />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Понизить Alice до игрока' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Понизить Alice до игрока' }));
    await waitFor(() => expect(api.putMember).toHaveBeenCalledTimes(2));
    expect(String(api.putMember.mock.calls[0][2].expectedRevision)).toBe('9007199254740993');
    expect(String(api.putMember.mock.calls[1][2].expectedRevision)).toBe('9007199254740994');
  });

  it('shows no speculative crown when a role change fails', async () => {
    api.putMember.mockRejectedValueOnce({ status: 503 });
    renderAt(<Members />, '/4/gm/members');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Повысить Alice до ГМ' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Повысить Alice до ГМ' }));
    await screen.findByRole('button', { name: 'Повторить' });
    expect(screen.queryByRole('img', { name: 'Гейм-мастер' })).not.toBeInTheDocument();
  });

  it('assigns a character at the selected access level and preserves unrelated rows', async () => {
    api.listMembers.mockResolvedValue([member, sibling]);
    api.listAssignments.mockImplementation(async (_id: number, id: string) => id === heroId ? [assignment] : [siblingAssignment]);
    api.putAssignment.mockResolvedValue({ campaignId: 4, characterId: miraId, userId: 21, canWrite: false, metadataRevision: 1 });
    renderAt(<Members />, '/4/gm/members');
    await screen.findByRole('row', { name: 'Участник Alice' });
    await waitForMembersReady();
    await screen.findByRole('row', { name: 'Участник Bea' });
    fireEvent.click(screen.getByRole('button', { name: 'Назначить персонажа Alice' }));
    const dialog = await screen.findByRole('dialog', { name: 'Назначить персонажа Alice' });
    expect(within(dialog).queryByRole('option', { name: 'Hero' })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Персонаж'), { target: { value: miraId } });
    fireEvent.change(within(dialog).getByLabelText('Уровень доступа'), { target: { value: 'read' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Назначить' }));
    await waitFor(() => expect(api.putAssignment).toHaveBeenCalledWith(4, miraId, 21, { canWrite: false, expectedRevision: 0 }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(rowNamed('Alice')).getByText('Hero')).toBeInTheDocument();
    expect(within(rowNamed('Alice')).getByText('Mira')).toBeInTheDocument();
    expect(within(rowNamed('Bea')).getByText('Mira')).toBeInTheDocument();
  });

  it('keeps an uncertain assignment check available after closing the dialog and resolves a present row without another PUT', async () => {
    api.putAssignment.mockRejectedValueOnce({ unknownOutcome: true });
    let heroReads = 0;
    api.listAssignments.mockImplementation(async (_id: number, id: string) => {
      if (id !== heroId) return [];
      heroReads += 1;
      return heroReads === 1 ? [] : [{ campaignId: 4, characterId: heroId, userId: 21, canWrite: false, metadataRevision: 1 }];
    });
    renderAt(<Members />, '/4/gm/members');
    await screen.findByRole('row', { name: 'Участник Alice' });
    await waitForMembersReady();
    fireEvent.click(screen.getByRole('button', { name: 'Назначить персонажа Alice' }));
    const dialog = await screen.findByRole('dialog', { name: 'Назначить персонажа Alice' });
    fireEvent.change(within(dialog).getByLabelText('Персонаж'), { target: { value: heroId } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Назначить' }));
    await screen.findByText('Результат добавления назначения не подтверждён.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    const verify = await screen.findByRole('button', { name: 'Проверить добавление назначения' });
    fireEvent.click(verify);
    await waitFor(() => expect(api.putAssignment).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('combobox', { name: 'Уровень доступа Hero для Alice' })).toHaveValue('read');
  });

  it('clears an absent uncertain assignment after reread and requires an explicit retry', async () => {
    api.putAssignment.mockRejectedValueOnce({ unknownOutcome: true }).mockResolvedValueOnce({ campaignId: 4, characterId: heroId, userId: 21, canWrite: false, metadataRevision: 1 });
    api.listAssignments.mockResolvedValue([]);
    renderAt(<Members />, '/4/gm/members');
    await screen.findByRole('row', { name: 'Участник Alice' });
    await waitForMembersReady();
    fireEvent.click(screen.getByRole('button', { name: 'Назначить персонажа Alice' }));
    let dialog = await screen.findByRole('dialog', { name: 'Назначить персонажа Alice' });
    fireEvent.change(within(dialog).getByLabelText('Персонаж'), { target: { value: heroId } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Назначить' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Закрыть' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Проверить добавление назначения' }));
    await waitFor(() => expect(screen.queryByText('Результат добавления назначения не подтверждён.')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Назначить персонажа Alice' }));
    dialog = await screen.findByRole('dialog', { name: 'Назначить персонажа Alice' });
    fireEvent.change(within(dialog).getByLabelText('Персонаж'), { target: { value: heroId } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Назначить' }));
    await waitFor(() => expect(api.putAssignment).toHaveBeenCalledTimes(2));
    expect(api.putAssignment).toHaveBeenLastCalledWith(4, heroId, 21, { canWrite: false, expectedRevision: 0 });
  });

  it('shows all assigned characters in each corresponding member row', async () => {
    api.listMembers.mockResolvedValue([member, sibling]);
    api.listAssignments.mockImplementation(async (_id: number, id: string) => id === heroId ? [assignment, { ...assignment, userId: 22, metadataRevision: 12 }] : [siblingAssignment, { ...siblingAssignment, userId: 21, metadataRevision: 20 }]);
    renderAt(<Members />, '/4/gm/members');
    await screen.findByRole('row', { name: 'Участник Alice' });
    expect(await within(rowNamed('Alice')).findByText('Hero')).toBeInTheDocument();
    expect(await within(rowNamed('Alice')).findByText('Mira')).toBeInTheDocument();
    expect(await within(rowNamed('Bea')).findByText('Hero')).toBeInTheDocument();
    expect(await within(rowNamed('Bea')).findByText('Mira')).toBeInTheDocument();
  });

  it('updates assignment access immediately with the acknowledged assignment revision', async () => {
    api.putAssignment.mockResolvedValueOnce({ ...assignment, canWrite: true, metadataRevision: 12 }).mockResolvedValueOnce({ ...assignment, canWrite: false, metadataRevision: 13 });
    renderAt(<Members />, '/4/gm/members');
    await waitForMembersReady();
    const accessSelect = await screen.findByRole('combobox', { name: 'Уровень доступа Hero для Alice' });
    fireEvent.change(accessSelect, { target: { value: 'write' } });
    await waitFor(() => expect(api.putAssignment).toHaveBeenNthCalledWith(1, 4, heroId, 21, { canWrite: true, expectedRevision: 11 }));
    await waitFor(() => expect(accessSelect).toHaveValue('write'));
    fireEvent.change(accessSelect, { target: { value: 'read' } });
    await waitFor(() => expect(api.putAssignment).toHaveBeenNthCalledWith(2, 4, heroId, 21, { canWrite: false, expectedRevision: 12 }));
  });

  it('retains a failed access target until reread and explicit retry with the fresh revision', async () => {
    api.putAssignment.mockRejectedValueOnce({ status: 409 }).mockResolvedValueOnce({ ...assignment, canWrite: true, metadataRevision: 13 });
    let heroReads = 0;
    api.listAssignments.mockImplementation(async (_id: number, id: string) => {
      if (id !== heroId) return [];
      heroReads += 1;
      return heroReads === 1 ? [assignment] : [{ ...assignment, metadataRevision: 12 }];
    });
    renderAt(<Members />, '/4/gm/members');
    await waitForMembersReady();
    const accessSelect = await screen.findByRole('combobox', { name: 'Уровень доступа Hero для Alice' });
    fireEvent.change(accessSelect, { target: { value: 'write' } });
    await screen.findByRole('button', { name: `Перечитать доступ Alice к Hero` });
    expect(accessSelect).toHaveValue('write');
    expect(api.putAssignment).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать доступ Alice к Hero' }));
    await screen.findByRole('button', { name: 'Повторить' });
    expect(api.putAssignment).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(api.putAssignment).toHaveBeenNthCalledWith(2, 4, heroId, 21, { canWrite: true, expectedRevision: 12 }));
  });

  it('keeps an access change blocked when its explicit reread fails', async () => {
    api.putAssignment.mockRejectedValueOnce({ status: 409 });
    let assignmentReads = 0;
    api.listAssignments.mockImplementation(async (_id: number, id: string) => {
      if (id !== heroId) return [];
      assignmentReads += 1;
      if (assignmentReads === 2) throw { status: 503 };
      return assignmentReads === 1 ? [assignment] : [{ ...assignment, metadataRevision: 12 }];
    });
    renderAt(<Members />, '/4/gm/members');
    await waitForMembersReady();
    const accessSelect = await screen.findByRole('combobox', { name: 'Уровень доступа Hero для Alice' });
    fireEvent.change(accessSelect, { target: { value: 'write' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Перечитать доступ Alice к Hero' }));
    await screen.findByRole('button', { name: 'Перечитать доступ Alice к Hero' });
    expect(api.putAssignment).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать доступ Alice к Hero' }));
    await screen.findByRole('button', { name: 'Повторить' });
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(api.putAssignment).toHaveBeenCalledTimes(2));
    expect(api.putAssignment).toHaveBeenLastCalledWith(4, heroId, 21, { canWrite: true, expectedRevision: 12 });
  });

  it('blocks duplicate in-flight role actions and disables other writes while pending', async () => {
    let resolve!: (value: typeof member) => void;
    api.putMember.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    renderAt(<Members />, '/4/gm/members');
    await waitForMembersReady();
    const promote = await screen.findByRole('button', { name: 'Повысить Alice до ГМ' });
    fireEvent.click(promote);
    expect(promote).toBeDisabled();
    fireEvent.click(promote);
    expect(api.putMember).toHaveBeenCalledTimes(1);
    resolve({ ...member, isAdmin: true, metadataRevision: 9 });
    await screen.findByRole('img', { name: 'Гейм-мастер' });
  });

  it('confirms assignment removal and sends only the revisioned delete', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt(<Members />, '/4/gm/members');
    await waitForMembersReady();
    await screen.findByRole('button', { name: 'Снять доступ Alice к Hero' });
    fireEvent.click(screen.getByRole('button', { name: 'Снять доступ Alice к Hero' }));
    expect(api.deleteAssignment).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Снять доступ Alice к Hero' }));
    await waitFor(() => expect(api.deleteAssignment).toHaveBeenCalledWith(4, heroId, 21, 11));
    expect(api.deleteMember).not.toHaveBeenCalled();
  });

  it('confirms an uncertain assignment deletion by rereading absence without replaying DELETE', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    let heroReads = 0;
    api.listAssignments.mockImplementation(async (_id: number, id: string) => {
      if (id !== heroId) return [];
      heroReads += 1;
      return heroReads === 1 ? [assignment, { ...assignment, userId: 22, metadataRevision: 12 }] : [{ ...assignment, userId: 22, metadataRevision: 12 }];
    });
    api.deleteAssignment.mockRejectedValueOnce({ unknownOutcome: true });
    api.listMembers.mockResolvedValue([member, sibling]);
    api.getUser.mockImplementation(async (id: number) => id === 21 ? user : otherUser);
    renderAt(<Members />, '/4/gm/members');
    await waitForMembersReady();
    await screen.findByRole('button', { name: 'Снять доступ Alice к Hero' });
    fireEvent.click(screen.getByRole('button', { name: 'Снять доступ Alice к Hero' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Перечитать доступ Alice к Hero' }));
    await waitFor(() => expect(api.listAssignments).toHaveBeenCalledTimes(2));
    expect(api.deleteAssignment).toHaveBeenCalledTimes(1);
    expect(within(rowNamed('Alice')).queryByText('Hero')).not.toBeInTheDocument();
    expect(within(rowNamed('Bea')).getByText('Hero')).toBeInTheDocument();
  });

  it('surfaces member_has_assignments without cascading and allows deletion after assignment removal', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.deleteMember.mockRejectedValueOnce({ status: 409, problem: { code: 'member_has_assignments' } }).mockResolvedValueOnce(undefined);
    renderAt(<Members />, '/4/gm/members');
    await waitForMembersReady();
    await screen.findByRole('button', { name: 'Удалить участника Alice' });
    fireEvent.click(screen.getByRole('button', { name: 'Удалить участника Alice' }));
    expect(await screen.findByText('Нельзя удалить участника: сначала снимите назначения персонажей в его строке.')).toBeInTheDocument();
    expect(api.deleteAssignment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Снять доступ Alice к Hero' }));
    await waitFor(() => expect(api.deleteAssignment).toHaveBeenCalledWith(4, heroId, 21, 11));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить участника Alice' }));
    await waitFor(() => expect(api.deleteMember).toHaveBeenNthCalledWith(2, 4, 21, 8));
  });

  it('rereads an uncertain member delete and never repeats it after confirmed absence', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.deleteMember.mockRejectedValueOnce({ unknownOutcome: true });
    api.listMembers.mockResolvedValueOnce([member, sibling]).mockResolvedValueOnce([sibling]);
    api.getUser.mockImplementation(async (id: number) => id === 21 ? user : otherUser);
    renderAt(<Members />, '/4/gm/members');
    await waitForMembersReady();
    await screen.findByRole('button', { name: 'Удалить участника Alice' });
    fireEvent.click(screen.getByRole('button', { name: 'Удалить участника Alice' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Перечитать участника Alice' }));
    await waitFor(() => expect(screen.queryByRole('row', { name: 'Участник Alice' })).not.toBeInTheDocument());
    expect(screen.getByRole('row', { name: 'Участник Bea' })).toBeInTheDocument();
    expect(api.deleteMember).toHaveBeenCalledTimes(1);
  });

  it('keeps rows visible and mutations disabled while campaign permissions refresh', async () => {
    const view = renderAt(<Members />, '/4/gm/members');
    const promote = await screen.findByRole('button', { name: 'Повысить Alice до ГМ' });
    context.permissionsLoading = true;
    view.rerender(<MemoryRouter initialEntries={['/4/gm/members']}><Routes><Route path=":groupId/gm/members" element={<Members />} /></Routes></MemoryRouter>);
    expect(screen.getByRole('row', { name: 'Участник Alice' })).toBeInTheDocument();
    expect(promote).toBeDisabled();
  });

  it('sends only the campaign name and expected metadata revision', async () => {
    renderAt(<CampaignSettings />, '/4/gm/settings');
    fireEvent.change(await screen.findByLabelText('Название кампании'), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(api.renameCampaign).toHaveBeenCalledWith(4, { name: 'New name', expectedRevision: 3 }));
  });

  it('keeps a successful campaign name until the shell refresh arrives', async () => {
    api.renameCampaign.mockResolvedValueOnce({ ...campaign, name: 'First saved', metadataRevision: 4 }).mockResolvedValueOnce({ ...campaign, name: 'Second saved', metadataRevision: 5 });
    renderAt(<CampaignSettings />, '/4/gm/settings');
    const field = await screen.findByLabelText('Название кампании');
    fireEvent.change(field, { target: { value: 'First saved' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await screen.findByText('Название сохранено.');
    expect(field).toHaveValue('First saved');
    fireEvent.change(field, { target: { value: 'Second saved' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(api.renameCampaign).toHaveBeenNthCalledWith(2, 4, { name: 'Second saved', expectedRevision: 4 }));
    expect(field).toHaveValue('Second saved');
    await screen.findByText('Название сохранено.');
  });

  it('retains the draft after conflict and requires explicit version reload', async () => {
    api.renameCampaign.mockRejectedValueOnce({ status: 409 }).mockResolvedValue({ ...campaign, name: 'Keep draft', metadataRevision: 5 });
    renderAt(<CampaignSettings />, '/4/gm/settings');
    const field = await screen.findByLabelText('Название кампании');
    fireEvent.change(field, { target: { value: 'Keep draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText(/Версия изменилась/)).toBeInTheDocument();
    expect(field).toHaveValue('Keep draft');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать версию' }));
    await waitFor(() => expect(api.getCampaign).toHaveBeenCalledWith(4));
    expect(field).toHaveValue('Keep draft');
    expect(await screen.findByText('Текущая версия: «Latest». Черновик: «Keep draft».')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('ревизия 4');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(api.renameCampaign).toHaveBeenLastCalledWith(4, { name: 'Keep draft', expectedRevision: 4 }));
  });

  it('freezes a dirty campaign name on a newer workspace snapshot and saves after explicit reread', async () => {
    const view = renderAt(<CampaignSettings />, '/4/gm/settings');
    const field = await screen.findByLabelText('Название кампании');
    fireEvent.change(field, { target: { value: 'Keep name draft' } });
    campaign = { id: 4, name: 'Changed elsewhere', metadataRevision: 4 };
    view.rerender(<MemoryRouter initialEntries={['/4/gm/settings']}><Routes><Route path=":groupId/gm/settings" element={<CampaignSettings />} /></Routes></MemoryRouter>);
    expect(await screen.findByText(/Версия изменилась/)).toBeInTheDocument();
    expect(field).toHaveValue('Keep name draft');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать версию' }));
    expect(await screen.findByText('Текущая версия: «Latest». Черновик: «Keep name draft».')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(api.renameCampaign).toHaveBeenCalledWith(4, { name: 'Keep name draft', expectedRevision: 4 }));
  });

  it('preserves the campaign-name draft while permissions are refreshing', async () => {
    const view = renderAt(<CampaignSettings />, '/4/gm/settings');
    const field = await screen.findByLabelText('Название кампании');
    fireEvent.change(field, { target: { value: 'Draft across refresh' } });
    context.permissionsLoading = true;
    view.rerender(<MemoryRouter initialEntries={['/4/gm/settings']}><Routes><Route path=":groupId/gm/settings" element={<CampaignSettings />} /></Routes></MemoryRouter>);
    expect(field).toHaveValue('Draft across refresh');
    expect(field).toBeDisabled();
    context.permissionsLoading = false;
    view.rerender(<MemoryRouter initialEntries={['/4/gm/settings']}><Routes><Route path=":groupId/gm/settings" element={<CampaignSettings />} /></Routes></MemoryRouter>);
    expect(field).toHaveValue('Draft across refresh');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
  });

  it('refreshes own permissions after a forbidden settings write', async () => {
    api.renameCampaign.mockRejectedValueOnce({ status: 403 });
    renderAt(<CampaignSettings />, '/4/gm/settings');
    fireEvent.change(await screen.findByLabelText('Название кампании'), { target: { value: 'Attempt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(context.notifyInvalidation).toHaveBeenCalledWith('permissions'));
  });

  it('does not treat a failed service write as success', async () => {
    api.renameCampaign.mockRejectedValue({ status: 503, message: 'unavailable' });
    renderAt(<CampaignSettings />, '/4/gm/settings');
    const field = await screen.findByLabelText('Название кампании');
    fireEvent.change(field, { target: { value: 'Draft only' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(api.renameCampaign).toHaveBeenCalled());
    expect(field).toHaveValue('Draft only');
    expect(screen.queryByText(/успешно сохранено/i)).not.toBeInTheDocument();
  });
});
