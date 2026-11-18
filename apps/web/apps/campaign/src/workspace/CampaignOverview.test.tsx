import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CampaignOverview from './CampaignOverview';

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

  it('shows supported counts, a compact character row, and the existing quick actions', async () => {
    renderOverview();
    expect(await screen.findByText('Персонажей: 1')).toBeInTheDocument();
    expect(await screen.findByText('Формул: 2')).toBeInTheDocument();
    expect(await screen.findByText('Представлений: 1')).toBeInTheDocument();
    const rosterName = await screen.findByText('Roster hero');
    expect(rosterName.tagName).toBe('STRONG');
    expect(screen.queryByRole('link', { name: 'Roster hero' })).not.toBeInTheDocument();
    expect(screen.getByText('Ключевой')).toBeInTheDocument();
    expect(screen.getByText('Можно вести и редактировать')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть лист Roster hero' })).toHaveAttribute('href', '/groups/12/gm/characters/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/overview');
    expect(screen.getByRole('link', { name: 'К списку персонажей' })).toHaveAttribute('href', '/groups/12/gm/characters');
    expect(screen.getByRole('link', { name: 'Настроить шаблон' })).toHaveAttribute('href', '/groups/12/gm/templates');
    expect(screen.getByRole('link', { name: 'Настроить формулы' })).toHaveAttribute('href', '/groups/12/gm/formulas');
    expect(screen.getByRole('link', { name: 'Настроить представления' })).toHaveAttribute('href', '/groups/12/gm/views');
    expect(api.listCharacters).toHaveBeenCalledTimes(2);
    expect(api.listFormulas).toHaveBeenCalledTimes(1);
    expect(api.listViews).toHaveBeenCalledTimes(1);
  });

  it('shows independent count loading and errors without substituting zero', async () => {
    api.listFormulas.mockRejectedValueOnce(new Error('Formula count unavailable'));
    renderOverview();
    expect(await screen.findByText('Formula count unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Формул: 0')).not.toBeInTheDocument();
    expect(await screen.findByText('Персонажей: 1')).toBeInTheDocument();
    expect(await screen.findByText('Представлений: 1')).toBeInTheDocument();
    expect(api.listFormulas).toHaveBeenCalledTimes(1);
    expect(api.listViews).toHaveBeenCalledTimes(1);
  });
});
