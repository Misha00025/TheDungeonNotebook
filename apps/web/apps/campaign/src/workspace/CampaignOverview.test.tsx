import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CampaignOverview from './CampaignOverview';
import GMOverviewRoster from './GMOverviewRoster';
import type { CharacterMetadata } from './types';

const api = vi.hoisted(() => ({ listCharacters: vi.fn(), characterPermissions: vi.fn(), listAssignments: vi.fn(), getUser: vi.fn(), getSheet: vi.fn(), listFormulas: vi.fn(), listViews: vi.fn() }));

vi.mock('./Workspace', () => ({
  useWorkspace: () => ({ api, path: (relative = '') => `/groups${relative}`, sessionKey: 'user', invalidation: 0 }),
}));

vi.mock('./Shell', () => ({
  useCampaignWorkspace: () => ({ campaign: { id: 12, name: 'Campaign 12' }, mode: 'gm', permissions: { canRead: true, canWrite: true, canManageAccess: false }, permissionsLoading: false }),
}));

const character: CharacterMetadata = { id: 'hero/one', campaignId: 12, name: 'Roster hero', importance: 'Key', metadataRevision: 1 };
const renderOverview = () => render(
  <MemoryRouter initialEntries={['/groups/12/gm/overview']}>
    <Routes><Route path="/groups/:groupId/gm/overview" element={<CampaignOverview />} /></Routes>
  </MemoryRouter>
);

describe('CampaignOverview', () => {
  beforeEach(() => {
    Object.values(api).forEach(method => method.mockReset());
    api.listCharacters.mockResolvedValue([character]);
    api.characterPermissions.mockResolvedValue({ canRead: true, canWrite: true, canManageAccess: true });
    api.listAssignments.mockResolvedValue([{ campaignId: 12, characterId: character.id, userId: 21, canWrite: true, metadataRevision: 1 }]);
    api.getUser.mockResolvedValue({ id: 21, nickname: 'gm', visibleName: 'Visible GM' });
    api.listFormulas.mockResolvedValue([{ id: 'formula-1' }, { id: 'formula-2' }]);
    api.listViews.mockResolvedValue([{ id: 'view-1' }]);
  });

  it('shows character count, empty placeholders, roster content, and existing quick actions', async () => {
    renderOverview();
    const statistic = await screen.findByRole('article', { name: 'Персонажи' });
    expect(within(statistic).getAllByText('Персонажи')).toHaveLength(1);
    expect(within(statistic).getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('Персонажей: 1')).not.toBeInTheDocument();
    const quests = screen.getByRole('heading', { name: 'Квесты' }).closest('section');
    const notes = screen.getByRole('heading', { name: 'Заметки' }).closest('section');
    expect(within(quests as HTMLElement).queryByRole('link')).not.toBeInTheDocument();
    expect(within(notes as HTMLElement).queryByRole('link')).not.toBeInTheDocument();
    const rosterLink = await screen.findByRole('link', { name: 'Открыть лист Roster hero' });
    expect(rosterLink).toHaveAttribute('href', '/groups/12/gm/characters/hero%2Fone/overview');
    expect(rosterLink).toHaveTextContent('Открыть');
    expect(screen.getByText('Roster hero')).toBeInTheDocument();
    expect(screen.getByText('Visible GM')).toBeInTheDocument();
    expect(screen.queryByText('Ключевой')).not.toBeInTheDocument();
    expect(screen.queryByText('Можно вести и редактировать')).not.toBeInTheDocument();
    expect(screen.queryByText('Только просмотр')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'К списку персонажей' })).toHaveAttribute('href', '/groups/12/gm/characters');
    expect(screen.getByRole('link', { name: 'Настроить шаблон' })).toHaveAttribute('href', '/groups/12/gm/templates');
    expect(screen.getByRole('link', { name: 'Настроить формулы' })).toHaveAttribute('href', '/groups/12/gm/formulas');
    expect(screen.getByRole('link', { name: 'Настроить представления' })).toHaveAttribute('href', '/groups/12/gm/views');
    expect(api.listCharacters).toHaveBeenCalledTimes(1);
    expect(api.listAssignments).toHaveBeenCalledTimes(1);
    expect(api.getUser).toHaveBeenCalledTimes(1);
    expect(api.getSheet).not.toHaveBeenCalled();
    expect(api.listFormulas).not.toHaveBeenCalled();
    expect(api.listViews).not.toHaveBeenCalled();
  });

  it('shows only assigned writers and does not request profiles for observers', async () => {
    const second = { ...character, id: 'character-two', name: 'Read-only assignee' };
    const third = { ...character, id: 'character-three', name: 'Unassigned character' };
    api.listCharacters.mockResolvedValue([character, second, third]);
    api.listAssignments.mockImplementation(async (_campaignId: number, id: string) => {
      if (id === character.id) return [
        { campaignId: 12, characterId: id, userId: 21, canWrite: true, metadataRevision: 1 },
        { campaignId: 12, characterId: id, userId: 22, canWrite: false, metadataRevision: 1 },
      ];
      if (id === second.id) return [{ campaignId: 12, characterId: id, userId: 22, canWrite: false, metadataRevision: 1 }];
      return [];
    });
    api.getUser.mockImplementation(async (id: number) => ({ id, nickname: `user-${id}`, visibleName: id === 21 ? 'Visible writer' : 'Observer' }));
    renderOverview();
    const link = await screen.findByRole('link', { name: 'Открыть лист Roster hero' });
    expect(link).toHaveAttribute('href', '/groups/12/gm/characters/hero%2Fone/overview');
    expect(screen.getByText('Roster hero')).toBeInTheDocument();
    expect(screen.getByText('Visible writer')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Открыть лист Read-only assignee' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Открыть лист Unassigned character' })).not.toBeInTheDocument();
    expect(screen.queryByText('Observer')).not.toBeInTheDocument();
    expect(api.listAssignments).toHaveBeenCalledTimes(3);
    expect(api.listAssignments).toHaveBeenCalledWith(12, character.id);
    expect(api.listAssignments).toHaveBeenCalledWith(12, second.id);
    expect(api.listAssignments).toHaveBeenCalledWith(12, third.id);
    expect(api.getUser).toHaveBeenCalledTimes(1);
    expect(api.getUser).toHaveBeenCalledWith(21);
    expect(api.getUser).not.toHaveBeenCalledWith(22);
  });

  it('renders multiple writer names beside one open link', async () => {
    api.listAssignments.mockResolvedValue([
      { campaignId: 12, characterId: character.id, userId: 21, canWrite: true, metadataRevision: 1 },
      { campaignId: 12, characterId: character.id, userId: 22, canWrite: true, metadataRevision: 1 },
    ]);
    api.getUser.mockImplementation(async (id: number) => ({ id, nickname: `user-${id}`, visibleName: `Writer ${id}` }));
    renderOverview();
    const link = await screen.findByRole('link', { name: 'Открыть лист Roster hero' });
    expect(screen.getByText('Roster hero')).toBeInTheDocument();
    expect(screen.getByText('Writer 21')).toBeInTheDocument();
    expect(screen.getByText('Writer 22')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Открыть лист Roster hero' })).toHaveLength(1);
    expect(link.textContent).toBe('Открыть');
  });

  it('shows a character count error without substituting zero or requesting unsupported counts', async () => {
    api.listCharacters.mockRejectedValue(new Error('Character count unavailable'));
    renderOverview();
    expect((await screen.findAllByText('Не удалось выполнить операцию. Попробуйте ещё раз.')).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('Character count unavailable');
    expect(screen.queryByRole('article', { name: 'Персонажи' })).not.toBeInTheDocument();
    expect(screen.queryByText('Персонажей: 0')).not.toBeInTheDocument();
    expect(api.listFormulas).not.toHaveBeenCalled();
    expect(api.listViews).not.toHaveBeenCalled();
    expect(api.listCharacters).toHaveBeenCalledTimes(1);
    expect(api.characterPermissions).not.toHaveBeenCalled();
  });

  it('keeps writable assignments on partial failure and falls back for a failed shared profile request', async () => {
    const second = { ...character, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Second hero', importance: 'Background' };
    const observer = { ...character, id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Observer hero' };
    const inaccessible = { ...character, id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Unavailable hero' };
    api.listCharacters.mockResolvedValue([character, second, observer, inaccessible]);
    api.characterPermissions.mockImplementation(async (_campaignId: number, id: string) => {
      if (id === observer.id) return { canRead: false, canWrite: false, canManageAccess: true };
      if (id === inaccessible.id) return { canRead: true, canWrite: false, canManageAccess: false };
      return { canRead: true, canWrite: true, canManageAccess: true };
    });
    api.listAssignments.mockImplementation(async (_campaignId: number, id: string) => id === character.id
      ? [{ campaignId: 12, characterId: id, userId: 21, canWrite: true, metadataRevision: 1 }, { campaignId: 12, characterId: id, userId: 22, canWrite: false, metadataRevision: 1 }]
      : [{ campaignId: 12, characterId: id, userId: 21, canWrite: true, metadataRevision: 1 }]);
    api.getUser.mockRejectedValue(new Error('profile unavailable'));
    renderOverview();
    await screen.findByRole('link', { name: 'Открыть лист Roster hero' });
    await screen.findByRole('link', { name: 'Открыть лист Second hero' });
    expect(screen.getByText('Roster hero')).toBeInTheDocument();
    expect(screen.getAllByText('Профиль недоступен')).toHaveLength(2);
    expect(screen.getByText('Second hero')).toBeInTheDocument();
    expect(screen.queryByText('Observer hero')).not.toBeInTheDocument();
    expect(screen.queryByText('Unavailable hero')).not.toBeInTheDocument();
    expect(screen.getByText('Сведения о ведущих недоступны.')).toBeInTheDocument();
    expect(screen.queryByText('Нет персонажей с назначенными ведущими.')).not.toBeInTheDocument();
    expect(api.listCharacters).toHaveBeenCalledTimes(1);
    expect(api.listAssignments).toHaveBeenCalledTimes(2);
    expect(api.getUser).toHaveBeenCalledTimes(1);
    expect(api.getSheet).not.toHaveBeenCalled();
  });

  it('retries aggregate assignment failures without showing a false empty state', async () => {
    api.listAssignments.mockRejectedValueOnce(new Error('assignment unavailable')).mockResolvedValueOnce([]);
    renderOverview();
    expect(await screen.findByText('Не удалось выполнить операцию. Попробуйте ещё раз.')).toBeInTheDocument();
    expect(screen.queryByText('Нет персонажей с назначенными ведущими.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
    expect(await screen.findByText('Нет персонажей с назначенными ведущими.')).toBeInTheDocument();
    expect(api.listCharacters).toHaveBeenCalledTimes(1);
    expect(api.listAssignments).toHaveBeenCalledTimes(2);
  });

  it('isolates a late roster response when session and campaign scope change', async () => {
    const oldCharacter = { ...character, id: 'old-character', name: 'Old character' };
    const newCharacter = { ...character, campaignId: 13, id: 'new-character', name: 'New character' };
    let resolveOldAssignments!: (assignments: { campaignId: number; characterId: string; userId: number; canWrite: boolean; metadataRevision: number }[]) => void;
    api.characterPermissions.mockResolvedValue({ canRead: true, canWrite: true, canManageAccess: true });
    api.listAssignments.mockImplementation((campaignId: number, id: string) => campaignId === 12
      ? new Promise<{ campaignId: number; characterId: string; userId: number; canWrite: boolean; metadataRevision: number }[]>(resolve => { resolveOldAssignments = resolve; })
      : Promise.resolve([{ campaignId: 13, characterId: id, userId: 32, canWrite: true, metadataRevision: 1 }]));
    api.getUser.mockImplementation(async (id: number) => ({ id, nickname: `user-${id}`, visibleName: id === 31 ? 'Old GM' : 'New GM' }));

    const view = render(<MemoryRouter><GMOverviewRoster campaignId={12} characters={[oldCharacter]} resourceKey="session-old:12:roster:0" /></MemoryRouter>);
    await waitFor(() => expect(api.listAssignments).toHaveBeenCalledWith(12, oldCharacter.id));
    view.rerender(<MemoryRouter><GMOverviewRoster campaignId={13} characters={[newCharacter]} resourceKey="session-new:13:roster:0" /></MemoryRouter>);

    const newLink = await screen.findByRole('link', { name: 'Открыть лист New character' });
    expect(newLink).toHaveAttribute('href', '/groups/13/gm/characters/new-character/overview');
    expect(screen.getByText('New character')).toBeInTheDocument();
    expect(screen.getByText('New GM')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Открыть лист Old character' })).not.toBeInTheDocument();
    expect(api.characterPermissions).toHaveBeenCalledWith(12, oldCharacter.id);
    expect(api.characterPermissions).toHaveBeenCalledWith(13, newCharacter.id);
    expect(api.listAssignments).toHaveBeenCalledWith(13, newCharacter.id);

    await act(async () => {
      resolveOldAssignments([{ campaignId: 12, characterId: oldCharacter.id, userId: 31, canWrite: true, metadataRevision: 1 }]);
    });
    await waitFor(() => expect(api.getUser).toHaveBeenCalledWith(31));
    expect(screen.queryByRole('link', { name: 'Открыть лист Old character' })).not.toBeInTheDocument();
    expect(screen.queryByText('Old GM')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть лист New character' })).toHaveAttribute('href', '/groups/13/gm/characters/new-character/overview');
  });
});
