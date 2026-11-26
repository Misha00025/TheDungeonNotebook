import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import World, { WorldCharactersPage } from './World';

const api = vi.hoisted(() => ({
  listWorldMaterials: vi.fn(),
  listCharacters: vi.fn(),
  characterPermissions: vi.fn(),
  getPresentation: vi.fn(),
  getSheet: vi.fn(),
}));
const state = vi.hoisted(() => ({ mode: 'gm' as 'gm' | 'player' }));

vi.mock('./Workspace', () => ({
  useWorkspace: () => ({
    api,
    path: (relative = '') => `/groups${relative}`,
    navigate: vi.fn(),
    sessionKey: 'session',
  }),
}));

vi.mock('./Shell', () => ({
  useCampaignWorkspace: () => ({
    campaign: { id: 12 },
    mode: state.mode,
    permissions: { canRead: true, canWrite: false, canManageAccess: false },
    permissionsLoading: false,
    reloadPermissions: vi.fn(),
  }),
}));

const tree = (mode: 'gm' | 'player') => (
  <MemoryRouter initialEntries={[`/groups/12/${mode}/world/locations`]}>
    <Routes>
      <Route path="/groups/:groupId/:mode/world/locations" element={<World kind="locations" />} />
      <Route path="/groups/:groupId/:mode/world/characters" element={<WorldCharactersPage />} />
    </Routes>
  </MemoryRouter>
);

describe('World characters', () => {
  beforeEach(() => {
    Object.values(api).forEach(method => method.mockReset());
    state.mode = 'gm';
    api.listWorldMaterials.mockResolvedValue([]);
    api.listCharacters.mockResolvedValue([
      { id: 'first', campaignId: 12, name: 'First hero', importance: 'Key', metadataRevision: 1 },
      { id: 'second', campaignId: 12, name: 'Second hero', importance: 'Key', metadataRevision: 1 },
    ]);
    api.characterPermissions.mockResolvedValue({ canRead: false, canWrite: false, canManageAccess: false });
    api.getPresentation.mockResolvedValue({ contentRevision: 1, defaults: {}, contextParams: {} });
    api.getSheet.mockResolvedValue({ description: '' });
  });

  it.each(['gm', 'player'] as const)('opens the shared list for %s using the backend list response without client permission filtering', async mode => {
    state.mode = mode;
    const returnedCharacters = mode === 'gm'
      ? [
          { id: 'first', campaignId: 12, name: 'First hero', importance: 'Key' as const, metadataRevision: 1 },
          { id: 'second', campaignId: 12, name: 'Second hero', importance: 'Key' as const, metadataRevision: 1 },
        ]
      : [{ id: 'first', campaignId: 12, name: 'First hero', importance: 'Key' as const, metadataRevision: 1 }];
    api.listCharacters.mockResolvedValue(returnedCharacters);
    render(tree(mode));

    fireEvent.click(screen.getByRole('link', { name: 'Персонажи' }));

    expect(await screen.findByRole('heading', { name: 'Персонажи кампании' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Открыть лист First hero' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ключевые' })).toBeInTheDocument();
    if (mode === 'gm') {
      expect(screen.getByRole('button', { name: 'Открыть лист Second hero' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Создать персонажа' })).toBeDisabled();
    } else {
      expect(screen.queryByText('Second hero')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Создать персонажа' })).not.toBeInTheDocument();
    }
    expect(api.listCharacters).toHaveBeenCalledWith(12);
    expect(api.characterPermissions).not.toHaveBeenCalled();
  });
});
