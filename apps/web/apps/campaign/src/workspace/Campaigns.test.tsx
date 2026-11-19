import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Campaigns from './Campaigns';

const api = vi.hoisted(() => ({ listCampaigns: vi.fn(), campaignPermissions: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());
const campaign = { id: 12, name: 'Test campaign', metadataRevision: 1 };

vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, path: (relative = '') => (`/tdn/groups${relative}`).replace(/\/$/, '') || '/', navigate, sessionKey: 'session', invalidation: 0 }), useDirtyDraft: () => vi.fn() }));

const renderCampaigns = (allowCreate = true, initial = '/tdn/groups') => render(<MemoryRouter initialEntries={[initial]}><Campaigns allowCreate={allowCreate} /></MemoryRouter>);

describe('Campaigns', () => {
  beforeEach(() => {
    Object.values(api).forEach(method => method.mockReset());
    navigate.mockReset();
    api.listCampaigns.mockResolvedValue([campaign]);
  });

  it.each([
    [{ canRead: true, canWrite: true }, 'Вести', 'ГМ', '/tdn/groups/12/gm/overview'],
    [{ canRead: false, canWrite: true }, 'Вести', 'ГМ', '/tdn/groups/12/gm/overview'],
    [{ canRead: true, canWrite: false }, 'Играть', 'Игрок', '/tdn/groups/12/player/characters'],
  ] as const)('shows one entry for permissions %o', async (permissions, action, role, destination) => {
    api.campaignPermissions.mockResolvedValue(permissions);
    renderCampaigns();
    const button = await screen.findByRole('button', { name: action });
    expect(screen.queryByRole('button', { name: action === 'Вести' ? 'Играть' : 'Вести' })).not.toBeInTheDocument();
    expect(screen.getByText(role)).toBeInTheDocument();
    fireEvent.click(button);
    expect(navigate).toHaveBeenCalledWith(destination);
  });

  it('keeps entry and role hidden while permissions load and when access is denied', async () => {
    let resolvePermissions!: (value: { canRead: boolean; canWrite: boolean }) => void;
    api.campaignPermissions.mockReturnValue(new Promise(resolve => { resolvePermissions = resolve; }));
    renderCampaigns();
    expect(await screen.findByText('Загрузка прав…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Вести' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Играть' })).not.toBeInTheDocument();
    expect(screen.queryByText('ГМ')).not.toBeInTheDocument();
    expect(screen.queryByText('Игрок')).not.toBeInTheDocument();
    await act(async () => { resolvePermissions({ canRead: false, canWrite: false }); });
    expect(await screen.findByText('Нет доступных действий.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Вести' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Играть' })).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the create form from the create action when creation is disabled on this page', async () => {
    api.campaignPermissions.mockResolvedValue({ canRead: true, canWrite: false });
    renderCampaigns(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Создать кампанию' }));
    expect(navigate).toHaveBeenCalledWith('/tdn/groups?create=1');
    expect(screen.queryByRole('heading', { name: 'Создать кампанию' })).not.toBeInTheDocument();
  });
});
