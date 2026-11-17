import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Members from './Members';
import CampaignSettings from './CampaignSettings';

const api = vi.hoisted(() => ({ listMembers: vi.fn(), listCharacters: vi.fn(), characterPermissions: vi.fn(), listAssignments: vi.fn(), getUser: vi.fn(), searchUsers: vi.fn(), putMember: vi.fn(), deleteMember: vi.fn(), putAssignment: vi.fn(), deleteAssignment: vi.fn(), renameCampaign: vi.fn(), getCampaign: vi.fn() }));
const context = vi.hoisted(() => ({ invalidation: 0, notifyInvalidation: vi.fn(), sessionKey: '7', permissionsLoading: false }));
let campaignPermissions = { canWrite: true, canManageAccess: true, canRead: true };
let campaign = { id: 4, name: 'Original', metadataRevision: 3 };

vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, ...context }), useDirtyDraft: () => vi.fn(), useDirtyState: () => false }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ campaign, permissions: campaignPermissions, lastKnownPermissions: campaignPermissions, permissionsLoading: context.permissionsLoading, mode: 'gm', reloadCampaign: vi.fn() }) }));

const member = { campaignId: 4, userId: 21, isAdmin: false, metadataRevision: 8 };
const characterId = 'abcdef01-2345-6789-abcd-ef0123456789';
const assignment = { campaignId: 4, characterId, userId: 21, canWrite: false, metadataRevision: 11 };
const user = { id: 21, nickname: 'alice', visibleName: 'Alice' };
const setupApi = () => {
  Object.values(api).forEach(method => method.mockReset());
  context.notifyInvalidation.mockReset();
  context.permissionsLoading = false;
  api.listMembers.mockResolvedValue([member]); api.listCharacters.mockResolvedValue([{ id: characterId, name: 'Hero' }]);
  api.characterPermissions.mockResolvedValue({ canRead: true, canWrite: true, canManageAccess: false });
  api.listAssignments.mockResolvedValue([assignment]); api.getUser.mockResolvedValue(user);
  api.putMember.mockResolvedValue(member); api.deleteMember.mockResolvedValue(undefined);
  api.putAssignment.mockResolvedValue(assignment); api.deleteAssignment.mockResolvedValue(undefined);
  api.getCampaign.mockResolvedValue({ ...campaign, name: 'Latest', metadataRevision: 4 });
  api.renameCampaign.mockResolvedValue({ ...campaign, name: 'Renamed', metadataRevision: 4 });
  campaignPermissions = { canWrite: true, canManageAccess: true, canRead: true };
  campaign = { id: 4, name: 'Original', metadataRevision: 3 };
};
const renderAt = (element: React.ReactNode, path: string) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path=":groupId/gm/members" element={element} /><Route path=":groupId/gm/settings" element={element} /></Routes></MemoryRouter>);

describe('campaign access and settings', () => {
  beforeEach(setupApi);

  it('does not list membership or assignments without access management permission', async () => {
    campaignPermissions = { canWrite: true, canManageAccess: false, canRead: true };
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText('Список членства доступен только управляющим доступом.');
    expect(api.listMembers).not.toHaveBeenCalled();
    expect(api.listAssignments).not.toHaveBeenCalled();
  });

  it('loads user profiles separately and writes a membership grant using its revision', async () => {
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    expect(api.listMembers).toHaveBeenCalledWith(4);
    expect(api.getUser).toHaveBeenCalledWith(21);
    fireEvent.click(screen.getByLabelText('Администратор кампании'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Сохранить' })[0]);
    await waitFor(() => expect(api.putMember).toHaveBeenCalledWith(4, 21, { isAdmin: true, expectedRevision: 8 }));
  });

  it('keeps a successful member value and revision until refreshed props arrive', async () => {
    api.putMember.mockResolvedValueOnce({ ...member, isAdmin: true, metadataRevision: 9 }).mockResolvedValueOnce({ ...member, isAdmin: false, metadataRevision: 10 });
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    const checkbox = screen.getByLabelText('Администратор кампании');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await screen.findByText('Изменения сохранены.');
    expect(checkbox).toBeChecked();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(api.putMember).toHaveBeenNthCalledWith(2, 4, 21, { isAdmin: false, expectedRevision: 9 }));
    expect(checkbox).not.toBeChecked();
  });

  it('inserts the selected signed int32 membership with revision zero and does not cascade on conflict', async () => {
    api.searchUsers.mockResolvedValue([{ id: -32, nickname: 'bob', visibleName: 'Bob' }]);
    api.putMember.mockRejectedValue({ status: 409 });
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    fireEvent.change(screen.getByLabelText('Никнейм'), { target: { value: 'bob' } });
    fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
    fireEvent.change(await screen.findByLabelText('Найденный пользователь'), { target: { value: '-32' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить участника' }));
    await waitFor(() => expect(api.putMember).toHaveBeenCalledWith(4, -32, { isAdmin: false, expectedRevision: 0 }));
    expect(api.deleteMember).not.toHaveBeenCalled();
    expect(api.putAssignment).not.toHaveBeenCalled();
  });

  it('does not list or mutate assignments when the selected character denies access management', async () => {
    api.characterPermissions.mockResolvedValue({ canRead: true, canWrite: true, canManageAccess: false });
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    fireEvent.change(screen.getByLabelText('Персонаж'), { target: { value: characterId } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет права управления назначениями');
    expect(api.listAssignments).not.toHaveBeenCalled();
    expect(api.putAssignment).not.toHaveBeenCalled();
    expect(api.deleteAssignment).not.toHaveBeenCalled();
  });

  it('retains a different member draft when a refresh invalidates list data', async () => {
    const sibling = { campaignId: 4, userId: 22, isAdmin: false, metadataRevision: 14 };
    api.listMembers.mockResolvedValue([member, sibling]);
    api.getUser.mockImplementation(async (id: number) => id === 21 ? user : { id, nickname: 'bob', visibleName: 'Bob' });
    const view = renderAt(<Members />, '/4/gm/members');
    const firstRow = (await screen.findByText('userId: 21 · alice')).closest('article');
    expect(await screen.findByText('userId: 22 · bob')).toBeInTheDocument();
    const memberCheckbox = within(firstRow as HTMLElement).getByLabelText('Администратор кампании');
    const siblingRow = screen.getByText('userId: 22 · bob').closest('article');
    const siblingCheckbox = within(siblingRow as HTMLElement).getByLabelText('Администратор кампании');
    fireEvent.click(memberCheckbox);
    context.invalidation += 1;
    view.rerender(<MemoryRouter initialEntries={['/4/gm/members']}><Routes><Route path=":groupId/gm/members" element={<Members />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(within(firstRow as HTMLElement).getByLabelText('Администратор кампании')).toBeChecked());
    expect(within(siblingRow as HTMLElement).getByLabelText('Администратор кампании')).not.toBeChecked();
    expect(api.listMembers).toHaveBeenCalledTimes(2);
  });

  it('keeps the member row mounted and disables writes while campaign permissions refresh', async () => {
    const view = renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    const checkbox = screen.getByLabelText('Администратор кампании');
    fireEvent.click(checkbox);
    context.permissionsLoading = true;
    view.rerender(<MemoryRouter initialEntries={['/4/gm/members']}><Routes><Route path=":groupId/gm/members" element={<Members />} /></Routes></MemoryRouter>);
    expect(screen.getByLabelText('Администратор кампании')).toBeInTheDocument();
    expect(screen.getByLabelText('Администратор кампании')).toBeChecked();
    expect(screen.getByLabelText('Администратор кампании')).toBeDisabled();
  });

  it('keeps assignment rows mounted with writes disabled while selected-character permissions refresh', async () => {
    let resolve!: (value: typeof campaignPermissions) => void;
    api.characterPermissions.mockResolvedValueOnce({ canRead: true, canWrite: true, canManageAccess: true }).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const view = renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    fireEvent.change(screen.getByLabelText('Персонаж'), { target: { value: characterId } });
    const checkbox = await screen.findByLabelText('Может редактировать персонажа');
    fireEvent.click(checkbox);
    context.invalidation += 1;
    view.rerender(<MemoryRouter initialEntries={['/4/gm/members']}><Routes><Route path=":groupId/gm/members" element={<Members />} /></Routes></MemoryRouter>);
    expect(screen.getByLabelText('Может редактировать персонажа')).toBeChecked();
    expect(screen.getByLabelText('Может редактировать персонажа')).toBeDisabled();
    resolve({ canRead: true, canWrite: true, canManageAccess: true });
    await waitFor(() => expect(screen.getByLabelText('Может редактировать персонажа')).toBeEnabled());
  });

  it('freezes a dirty member row when the server revision changes and keeps its draft through reread', async () => {
    const latest = { ...member, isAdmin: false, metadataRevision: 9 };
    api.listMembers.mockResolvedValueOnce([member]).mockResolvedValue([latest]);
    const view = renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    const checkbox = screen.getByLabelText('Администратор кампании');
    fireEvent.click(checkbox);
    context.invalidation += 1;
    view.rerender(<MemoryRouter initialEntries={['/4/gm/members']}><Routes><Route path=":groupId/gm/members" element={<Members />} /></Routes></MemoryRouter>);
    expect(await screen.findByText(/Актуальная версия: участник \(ревизия 9\)/)).toBeInTheDocument();
    expect(checkbox).toBeChecked();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать запись' }));
    await waitFor(() => expect(api.listMembers).toHaveBeenCalledTimes(3));
    expect(checkbox).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(api.putMember).toHaveBeenCalledWith(4, 21, { isAdmin: true, expectedRevision: 9 }));
  });

  it('loads assignments after selecting a character and uses the row revision for access writes', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.characterPermissions.mockResolvedValue({ canRead: true, canWrite: true, canManageAccess: true });
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    fireEvent.change(screen.getByLabelText('Персонаж'), { target: { value: characterId } });
    await screen.findByText(/доступ к персонажу/);
    expect(api.characterPermissions).toHaveBeenCalledWith(4, characterId);
    expect(api.listAssignments).toHaveBeenCalledWith(4, characterId);
    fireEvent.click(screen.getByLabelText('Может редактировать персонажа'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Сохранить' }).at(-1)!);
    await waitFor(() => expect(api.putAssignment).toHaveBeenCalledWith(4, characterId, 21, { canWrite: true, expectedRevision: 11 }));
    confirm.mockRestore();
  });

  it('keeps a successful assignment value and revision until refreshed props arrive', async () => {
    api.characterPermissions.mockResolvedValue({ canRead: true, canWrite: true, canManageAccess: true });
    api.putAssignment.mockResolvedValueOnce({ ...assignment, canWrite: true, metadataRevision: 12 }).mockResolvedValueOnce({ ...assignment, canWrite: false, metadataRevision: 13 });
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    fireEvent.change(screen.getByLabelText('Персонаж'), { target: { value: characterId } });
    const checkbox = await screen.findByLabelText('Может редактировать персонажа');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getAllByRole('button', { name: 'Сохранить' }).at(-1)!);
    await screen.findByText('Изменения сохранены.');
    expect(checkbox).toBeChecked();
    expect(screen.getAllByRole('button', { name: 'Сохранить' }).at(-1)).toBeDisabled();
    fireEvent.click(checkbox);
    fireEvent.click(screen.getAllByRole('button', { name: 'Сохранить' }).at(-1)!);
    await waitFor(() => expect(api.putAssignment).toHaveBeenNthCalledWith(2, 4, characterId, 21, { canWrite: false, expectedRevision: 12 }));
    expect(checkbox).not.toBeChecked();
  });

  it('retains assignment draft after changed revision and only enables writes with selected-character permission', async () => {
    api.characterPermissions.mockResolvedValue({ canRead: true, canWrite: true, canManageAccess: true });
    api.listAssignments.mockResolvedValueOnce([assignment]).mockResolvedValue([{ ...assignment, canWrite: false, metadataRevision: 12 }]);
    const view = renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    fireEvent.change(screen.getByLabelText('Персонаж'), { target: { value: characterId } });
    const checkbox = await screen.findByLabelText('Может редактировать персонажа');
    fireEvent.click(checkbox);
    context.invalidation += 1;
    view.rerender(<MemoryRouter initialEntries={['/4/gm/members']}><Routes><Route path=":groupId/gm/members" element={<Members />} /></Routes></MemoryRouter>);
    expect(await screen.findByText(/Актуальная версия: только просмотр \(ревизия 12\)/)).toBeInTheDocument();
    expect(checkbox).toBeChecked();
    expect(screen.getAllByRole('button', { name: 'Сохранить' }).at(-1)).toBeDisabled();
  });

  it('confirms an unknown delete by rereading absence and does not repeat DELETE', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.deleteMember.mockRejectedValue({ unknownOutcome: true, message: 'connection lost' });
    api.listMembers.mockResolvedValueOnce([member]).mockResolvedValueOnce([]);
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить членство' }));
    await screen.findByText(/Изменение не подтверждено/);
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать запись' }));
    expect(await screen.findByText('Запись отсутствует на сервере. Черновик оставлен только для чтения.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить отсутствие записи' }));
    expect(api.deleteMember).toHaveBeenCalledTimes(1);
    vi.mocked(window.confirm).mockRestore();
  });

  it('keeps member_has_assignments as a domain conflict without cascading', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.deleteMember.mockRejectedValue({ status: 409, problem: { code: 'member_has_assignments' } });
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить членство' }));
    expect(await screen.findByText(/к участнику привязаны назначения/)).toBeInTheDocument();
    expect(api.deleteAssignment).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockRestore();
  });

  it('sends only the campaign name and expected metadata revision', async () => {
    renderAt(<CampaignSettings />, '/4/gm/settings');
    fireEvent.change(await screen.findByLabelText('Название кампании'), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(api.renameCampaign).toHaveBeenCalledWith(4, { name: 'New name', expectedRevision: 3 }));
  });

  it('keeps the successful campaign name until the shell refresh arrives', async () => {
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
    expect(await screen.findByText(/Текущая версия: «Latest», ревизия 4/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(api.renameCampaign).toHaveBeenLastCalledWith(4, { name: 'Keep draft', expectedRevision: 4 }));
    expect(await screen.findByText('Название сохранено.')).toBeInTheDocument();
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
    expect(await screen.findByText(/Текущая версия: «Latest», ревизия 4/)).toBeInTheDocument();
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

  it('checks an uncertain member add and does not resend when the member exists', async () => {
    const newMember = { campaignId: 4, userId: 31, isAdmin: false, metadataRevision: 1 };
    api.searchUsers.mockResolvedValue([{ id: 31, nickname: 'newbie', visibleName: 'Newbie' }]);
    api.putMember.mockRejectedValue({ unknownOutcome: true });
    api.listMembers.mockResolvedValueOnce([member]).mockResolvedValue([member, newMember]);
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    fireEvent.change(screen.getByLabelText('Никнейм'), { target: { value: 'newbie' } });
    fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
    fireEvent.change(await screen.findByLabelText('Найденный пользователь'), { target: { value: '31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить участника' }));
    expect(await screen.findByText('Результат добавления участника не подтверждён.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Проверить добавление' }));
    expect(await screen.findByText(/Запись уже существует/)).toBeInTheDocument();
    expect(api.putMember).toHaveBeenCalledTimes(1);
  });

  it('unlocks an uncertain member add only after absence is confirmed', async () => {
    const newMember = { campaignId: 4, userId: 31, isAdmin: false, metadataRevision: 1 };
    api.searchUsers.mockResolvedValue([{ id: 31, nickname: 'newbie', visibleName: 'Newbie' }]);
    api.putMember.mockRejectedValueOnce({ unknownOutcome: true }).mockResolvedValue(newMember);
    api.listMembers.mockResolvedValueOnce([member]).mockResolvedValueOnce([member]);
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    fireEvent.change(screen.getByLabelText('Никнейм'), { target: { value: 'newbie' } });
    fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
    fireEvent.change(await screen.findByLabelText('Найденный пользователь'), { target: { value: '31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить участника' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Проверить добавление' }));
    await waitFor(() => expect(screen.queryByText('Результат добавления участника не подтверждён.')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Добавить участника' }));
    await waitFor(() => expect(api.putMember).toHaveBeenCalledTimes(2));
    expect(api.putMember).toHaveBeenLastCalledWith(4, 31, { isAdmin: false, expectedRevision: 0 });
  });

  it('checks an uncertain assignment add without retrying the PUT', async () => {
    api.characterPermissions.mockResolvedValue({ canRead: true, canWrite: true, canManageAccess: true });
    api.listAssignments.mockResolvedValueOnce([]).mockResolvedValue([assignment]);
    api.putAssignment.mockRejectedValue({ unknownOutcome: true });
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    fireEvent.change(screen.getByLabelText('Персонаж'), { target: { value: characterId } });
    fireEvent.change(await screen.findByLabelText('Добавить участника'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Назначить' }));
    expect(await screen.findByText('Результат добавления назначения не подтверждён.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Проверить добавление' }));
    expect(await screen.findByText(/Запись уже существует/)).toBeInTheDocument();
    expect(api.putAssignment).toHaveBeenCalledTimes(1);
  });

  it('keeps a missing assignment row and its draft until absence is acknowledged', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.characterPermissions.mockResolvedValue({ canRead: true, canWrite: true, canManageAccess: true });
    api.deleteAssignment.mockRejectedValue({ unknownOutcome: true });
    api.listAssignments.mockResolvedValueOnce([assignment]).mockResolvedValueOnce([]);
    renderAt(<Members />, '/4/gm/members');
    await screen.findByText(/· alice/);
    fireEvent.change(screen.getByLabelText('Персонаж'), { target: { value: characterId } });
    const checkbox = await screen.findByLabelText('Может редактировать персонажа');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Снять доступ' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Перечитать запись' }));
    expect(await screen.findByText('Запись отсутствует на сервере. Черновик оставлен только для чтения.')).toBeInTheDocument();
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(context.notifyInvalidation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить отсутствие записи' }));
    expect(context.notifyInvalidation).toHaveBeenCalledWith('access');
    vi.mocked(window.confirm).mockRestore();
  });

  it('refreshes own permissions after a forbidden settings write', async () => {
    api.renameCampaign.mockRejectedValue({ status: 403 });
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
