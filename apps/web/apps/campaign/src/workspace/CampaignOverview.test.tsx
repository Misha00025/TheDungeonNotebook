import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CampaignOverview from './CampaignOverview';
import panelStyles from '@tdn/shared/ui/Panel/Panel.module.css';

const api = vi.hoisted(() => ({ listCharacters: vi.fn(), characterPermissions: vi.fn(), listFormulas: vi.fn(), listViews: vi.fn() }));

vi.mock('./Workspace', () => ({
  useWorkspace: () => ({ api, path: (relative = '') => `/groups${relative}`, sessionKey: 'user', invalidation: 0 }),
}));

vi.mock('./Shell', () => ({
  useCampaignWorkspace: () => ({ campaign: { id: 12, name: 'Campaign 12' }, mode: 'gm', permissions: { canRead: true, canWrite: true, canManageAccess: false }, permissionsLoading: false }),
}));

const character = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', campaignId: 12, name: 'Roster hero', importance: 'Key', metadataRevision: 1 };
const renderOverview = () => render(
  <MemoryRouter initialEntries={['/groups/12/gm/overview']}>
    <Routes><Route path="/groups/:groupId/gm/overview" element={<CampaignOverview />} /></Routes>
  </MemoryRouter>
);

describe('CampaignOverview', () => {
  beforeEach(() => {
    Object.values(api).forEach(method => method.mockReset());
    api.listCharacters.mockResolvedValue([character]);
    api.characterPermissions.mockResolvedValue({ canRead: true, canWrite: true, canManageAccess: false });
    api.listFormulas.mockResolvedValue([{ id: 'formula-1' }, { id: 'formula-2' }]);
    api.listViews.mockResolvedValue([{ id: 'view-1' }]);
  });

  it('shows one supported Statistic, empty placeholders, a compact roster, and existing quick actions', async () => {
    renderOverview();
    const statistic = await screen.findByRole('article', { name: 'Персонажи' });
    expect(within(statistic).getAllByText('Персонажи')).toHaveLength(1);
    expect(statistic.querySelectorAll('dt')).toHaveLength(1);
    expect(statistic.querySelector('dd')).toHaveTextContent('1');
    expect(screen.queryByText('Персонажей: 1')).not.toBeInTheDocument();
    const questsHeading = screen.getByRole('heading', { name: 'Квесты' });
    const notesHeading = screen.getByRole('heading', { name: 'Заметки' });
    const quests = questsHeading.closest(`.${panelStyles.panel}`);
    const notes = notesHeading.closest(`.${panelStyles.panel}`);
    expect(quests?.querySelector(`.${panelStyles.body}`)).toBeNull();
    expect(notes?.querySelector(`.${panelStyles.body}`)).toBeNull();
    expect(within(quests as HTMLElement).queryByRole('link')).not.toBeInTheDocument();
    expect(within(notes as HTMLElement).queryByRole('link')).not.toBeInTheDocument();
    const rosterName = await screen.findByText('Roster hero');
    expect(rosterName.tagName).toBe('STRONG');
    expect(screen.queryByRole('link', { name: 'Roster hero' })).not.toBeInTheDocument();
    expect(screen.getByText('Ключевой')).toBeInTheDocument();
    expect(screen.getAllByText('Ключевой')).toHaveLength(1);
    expect(screen.queryByText('Можно вести и редактировать')).not.toBeInTheDocument();
    expect(screen.queryByText('Только просмотр')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть лист Roster hero' })).toHaveAttribute('href', '/groups/12/gm/characters/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/overview');
    expect(screen.getByRole('link', { name: 'К списку персонажей' })).toHaveAttribute('href', '/groups/12/gm/characters');
    expect(screen.getByRole('link', { name: 'Настроить шаблон' })).toHaveAttribute('href', '/groups/12/gm/templates');
    expect(screen.getByRole('link', { name: 'Настроить формулы' })).toHaveAttribute('href', '/groups/12/gm/formulas');
    expect(screen.getByRole('link', { name: 'Настроить представления' })).toHaveAttribute('href', '/groups/12/gm/views');
    expect(api.listCharacters).toHaveBeenCalledTimes(2);
    expect(api.listFormulas).not.toHaveBeenCalled();
    expect(api.listViews).not.toHaveBeenCalled();
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
    expect(api.listCharacters).toHaveBeenCalledTimes(2);
    expect(api.characterPermissions).not.toHaveBeenCalled();
  });
});
