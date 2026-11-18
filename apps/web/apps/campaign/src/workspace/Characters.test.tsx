import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Characters from './Characters';
import panelStyles from '@tdn/shared/ui/Panel/Panel.module.css';
import listItemStyles from '@tdn/shared/ui/List/ListItem.module.css';

const api = vi.hoisted(() => ({ listCharacters: vi.fn(), characterPermissions: vi.fn(), getSheet: vi.fn() }));
const characters = [
  { id: 'key-id', campaignId: 12, name: 'Key hero', importance: 'Key', metadataRevision: 1 },
  { id: 'secondary-id', campaignId: 12, name: 'Secondary hero', importance: 'Secondary', metadataRevision: 1 },
  { id: 'background-id', campaignId: 12, name: 'Background hero', importance: 'Background', metadataRevision: 1 },
];

vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, path: (relative = '') => `/groups${relative}`, sessionKey: 'session', invalidation: 0 }) }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ campaign: { id: 12 }, mode: 'gm', permissions: { canRead: true, canWrite: true, canManageAccess: true }, permissionsLoading: false }) }));

const renderCharacters = () => render(<MemoryRouter initialEntries={['/groups/12/gm/characters']}><Routes><Route path="/groups/:groupId/gm/characters" element={<Characters />} /></Routes></MemoryRouter>);

describe('GM Characters', () => {
  beforeEach(() => {
    Object.values(api).forEach(method => method.mockReset());
    api.listCharacters.mockResolvedValue(characters);
    api.characterPermissions.mockResolvedValue({ canRead: true, canWrite: true, canManageAccess: false });
    api.getSheet.mockImplementation(async (_campaignId: number, id: string) => ({ description: `${id} description` }));
  });

  it('groups visible characters by importance and loads descriptions from basic sheets', async () => {
    renderCharacters();
    const key = await screen.findByRole('region', { name: 'Ключевые' });
    const secondary = screen.getByRole('region', { name: 'Второстепенные' });
    const background = screen.getByRole('region', { name: 'Фоновые' });
    expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(['Ключевые', 'Второстепенные', 'Фоновые']);
    expect(within(key).getByRole('heading', { name: 'Key hero', level: 4 })).toBeInTheDocument();
    expect(within(secondary).getByRole('heading', { name: /Secondary hero/, level: 4 })).toBeInTheDocument();
    expect(within(background).getByText('Background hero')).toBeInTheDocument();
    expect(within(key).getByRole('article')).not.toHaveClass(panelStyles.compact);
    expect(within(secondary).getByRole('article')).toHaveClass(panelStyles.compact);
    expect(within(background).getByText('Background hero').closest(`.${listItemStyles.listItem}`)).toHaveClass(listItemStyles.compact);
    expect(await screen.findByText('key-id description')).toBeInTheDocument();
    expect(await screen.findByText('secondary-id description')).toBeInTheDocument();
    expect(await screen.findByText('background-id description')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть лист Key hero' })).toHaveAttribute('href', '/groups/12/gm/characters/key-id/overview');
    expect(screen.getByRole('link', { name: 'Открыть лист Secondary hero' })).toHaveAttribute('href', '/groups/12/gm/characters/secondary-id/overview');
    expect(screen.getByRole('link', { name: 'Открыть лист Background hero' })).toHaveAttribute('href', '/groups/12/gm/characters/background-id/overview');
    expect(screen.queryByText('Ключевой')).not.toBeInTheDocument();
    expect(screen.queryByText('Второстепенный')).not.toBeInTheDocument();
    expect(screen.queryByText('Фоновый')).not.toBeInTheDocument();
    expect(api.getSheet).toHaveBeenCalledTimes(3);
    expect(api.getSheet.mock.calls.every(([id]) => id === 12)).toBe(true);
  });

  it('shows empty descriptions and does not request sheets for denied characters', async () => {
    api.listCharacters.mockResolvedValue([characters[0], characters[1]]);
    api.characterPermissions.mockImplementation(async (_campaignId: number, id: string) => id === characters[1].id ? { canRead: false, canWrite: false, canManageAccess: false } : { canRead: true, canWrite: true, canManageAccess: false });
    api.getSheet.mockResolvedValue({ description: '' });
    renderCharacters();
    expect(await screen.findByText('Описание не задано.')).toBeInTheDocument();
    await waitFor(() => expect(api.getSheet).toHaveBeenCalledTimes(1));
    expect(api.getSheet).toHaveBeenCalledWith(12, characters[0].id);
    expect(screen.queryByText('Secondary hero')).not.toBeInTheDocument();
  });

  it('does not request a sheet while permissions are pending', async () => {
    let resolvePermissions!: (value: { canRead: boolean; canWrite: boolean; canManageAccess: boolean }) => void;
    api.characterPermissions.mockReturnValue(new Promise(resolve => { resolvePermissions = resolve; }));
    renderCharacters();
    expect(await screen.findByText('Загрузка прав персонажа «Key hero»…')).toBeInTheDocument();
    expect(api.getSheet).not.toHaveBeenCalled();
    await act(async () => { resolvePermissions({ canRead: true, canWrite: true, canManageAccess: false }); });
    expect(await screen.findByText('key-id description')).toBeInTheDocument();
    expect(api.getSheet).toHaveBeenCalledWith(12, characters[0].id);
  });

  it('keeps sheet entrypoints visible when description loading fails', async () => {
    api.getSheet.mockRejectedValueOnce(new Error('sheet unavailable')).mockRejectedValueOnce(new Error('sheet unavailable')).mockRejectedValueOnce(new Error('sheet unavailable')).mockResolvedValue({ description: 'Recovered description' });
    renderCharacters();
    expect(await screen.findByRole('link', { name: 'Открыть лист Key hero' })).toBeInTheDocument();
    await screen.findAllByText('Не удалось выполнить операцию. Попробуйте ещё раз.');
    await waitFor(() => expect(screen.getAllByText('Не удалось выполнить операцию. Попробуйте ещё раз.')).toHaveLength(3));
    expect(document.body.textContent).not.toContain('sheet unavailable');
    fireEvent.click(screen.getAllByRole('button', { name: 'Повторить загрузку' })[0]);
    expect(await screen.findByText('Recovered description')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть лист Key hero' })).toHaveAttribute('href', '/groups/12/gm/characters/key-id/overview');
    expect(screen.getByRole('link', { name: 'Открыть лист Secondary hero' })).toHaveAttribute('href', '/groups/12/gm/characters/secondary-id/overview');
    expect(screen.getByRole('link', { name: 'Открыть лист Background hero' })).toHaveAttribute('href', '/groups/12/gm/characters/background-id/overview');
  });
});
