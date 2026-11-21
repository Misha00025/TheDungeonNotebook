import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterMetadata, ComputedSheet, JsonValue, ResolvedPresentation, Revision } from './types';
import { CampaignApiError } from './api';
import { stringifyJson } from './json';
import { DirtyProvider } from './Workspace';
import { VisitHistoryProvider } from './VisitHistory';
import Characters from './Characters';

const api = vi.hoisted(() => ({
  listCharacters: vi.fn(),
  characterPermissions: vi.fn(),
  getPresentation: vi.fn(),
  resolvePresentation: vi.fn(),
  getComputedSheet: vi.fn(),
  getCharacter: vi.fn(),
  putBaseValue: vi.fn(),
}));
const navigate = vi.hoisted(() => vi.fn());
const reloadPermissions = vi.hoisted(() => vi.fn());

vi.mock('./Workspace', async importOriginal => {
  const original = await importOriginal<typeof import('./Workspace')>();
  return { ...original, useWorkspace: () => ({ api, path: (relative = '') => `/groups${relative}`, sessionKey: 'session', navigate }) };
});

vi.mock('./Shell', async () => {
  const { useLocation } = await import('react-router-dom');
  const useCampaignWorkspace = () => {
    const location = useLocation();
    return { campaign: { id: 12 }, mode: location.pathname.includes('/gm/') ? 'gm' : 'player', permissions: { canRead: true, canWrite: true, canManageAccess: false }, permissionsLoading: false };
  };
  return { useCampaignWorkspace, useOptionalCampaignWorkspace: () => ({ permissions: { canRead: true, canWrite: true }, permissionsLoading: false, reloadPermissions }) };
});

const campaignId = 12;
const character: CharacterMetadata = { id: '11111111-1111-4111-8111-111111111111', campaignId, name: 'Card hero', importance: 'Key', metadataRevision: 2 };
const fieldId = '22222222-2222-4222-8222-222222222222';
const virtualId = '33333333-3333-4333-8333-333333333333';
const initialSheet: ComputedSheet = {
  contentRevision: 7,
  templateContentRevision: 3,
  description: 'Card description',
  baseFields: [{ id: fieldId, key: 'strength', title: 'Strength source', description: '', valueType: 'Integer', typeRevision: 1, options: [], effectiveValue: 3, isExplicit: true }],
  formulaContentRevisions: [],
  virtualFields: [{ id: virtualId, key: 'derived', title: 'Derived source', description: '', resultType: 'Integer', value: 8, diagnostic: null }],
};
const presentationConfig = { contentRevision: 4, defaults: { character_card: 'card-view-key' }, contextParams: {} };
const cardPresentation: ResolvedPresentation = {
  contextKey: 'character_card',
  viewMetadata: { id: 'card-view-id', key: 'card-view-key', campaignId, name: 'Card view', metadataRevision: 1 },
  viewContent: { campaignId, resourceId: 'card-view-id', contentRevision: 5, data: { roots: [{ kind: 'layout', nodeKey: 'stats', title: 'Statistics', params: { version: 1, type: 'stat-list', columns: 1, entries: [{ source: { kind: 'Base', fieldId }, label: 'Strength' }, { source: { kind: 'Virtual', fieldId: virtualId }, label: 'Derived' }] }, children: [] }] } },
  contextParams: null,
  contentRevision: 5,
};

let currentSheet: ComputedSheet;
let permissions = { canRead: true, canWrite: true, canManageAccess: false };

const renderCharacters = (mode: 'gm' | 'player' = 'gm') => render(
  <MemoryRouter initialEntries={[`/groups/${campaignId}/${mode}/characters`]}>
    <DirtyProvider>
      <VisitHistoryProvider sessionKey="session">
        <Routes><Route path="/groups/:groupId/:mode/characters" element={<Characters />} /></Routes>
      </VisitHistoryProvider>
    </DirtyProvider>
  </MemoryRouter>,
);

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach(mock => mock.mockReset());
  navigate.mockReset();
  reloadPermissions.mockReset();
  permissions = { canRead: true, canWrite: true, canManageAccess: false };
  currentSheet = initialSheet;
  api.listCharacters.mockResolvedValue([character]);
  api.characterPermissions.mockImplementation(async () => permissions);
  api.getPresentation.mockResolvedValue(presentationConfig);
  api.resolvePresentation.mockResolvedValue(cardPresentation);
  api.getComputedSheet.mockImplementation(async () => currentSheet);
  api.getCharacter.mockResolvedValue(character);
  api.putBaseValue.mockImplementation(async (_campaign: number, _characterId: string, _baseFieldId: string, body: { value: JsonValue; expectedRevision: Revision }) => {
    currentSheet = { ...currentSheet, contentRevision: 8, baseFields: currentSheet.baseFields.map(field => field.id === fieldId ? { ...field, effectiveValue: body.value } : field) };
    return currentSheet;
  });
});

describe('character cards in full lists', () => {
  it.each(['gm', 'player'] as const)('writes one base value from a %s card without leaving the list', async mode => {
    renderCharacters(mode);
    const inputButton = await screen.findByRole('button', { name: 'Изменить показатель Strength' });
    fireEvent.click(inputButton);
    const input = await screen.findByRole('textbox', { name: 'Strength' });
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input, { relatedTarget: document.body });

    await waitFor(() => expect(api.putBaseValue).toHaveBeenCalledTimes(1));
    const call = api.putBaseValue.mock.calls[0]!;
    expect(call.slice(0, 3)).toEqual([campaignId, character.id, fieldId]);
    expect(stringifyJson(call[3])).toBe('{"value":5,"expectedRevision":7}');
    expect(screen.getByRole('heading', { name: mode === 'gm' ? 'Персонажи кампании' : 'Мои персонажи' })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(api.getCharacter).not.toHaveBeenCalled();
    expect(api.getPresentation).toHaveBeenCalledTimes(1);
    expect(api.resolvePresentation).toHaveBeenCalledTimes(1);
    expect(api.resolvePresentation).toHaveBeenCalledWith(campaignId, 'character_card');
    expect(screen.getByText('Derived')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Изменить показатель Derived' })).not.toBeInTheDocument();
  });

  it('does not expose value editing when the character is read-only', async () => {
    permissions = { canRead: true, canWrite: false, canManageAccess: false };
    renderCharacters();

    expect(await screen.findByText('Card description')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть лист Card hero' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Изменить показатель Strength' })).not.toBeInTheDocument();
    expect(api.putBaseValue).not.toHaveBeenCalled();
  });

  it('retains an invalid card draft through search filtering without writing it', async () => {
    renderCharacters();
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить показатель Strength' }));
    const input = await screen.findByRole('textbox', { name: 'Strength' });
    fireEvent.change(input, { target: { value: '-' } });
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(api.putBaseValue).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Поиск персонажей' }), { target: { value: 'no matching name' } });
    expect(await screen.findByRole('link', { name: 'Открыть лист Card hero' })).toBeInTheDocument();
    expect(screen.getByText(/Карточки с несохранённым вводом/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Изменить показатель Strength' }));
    expect(await screen.findByRole('textbox', { name: 'Strength' })).toHaveValue('-');
    expect(api.putBaseValue).not.toHaveBeenCalled();
  });

  it('keeps card identity and entry point after initial sheet failure and recovers on explicit retry', async () => {
    api.getComputedSheet.mockRejectedValueOnce(new Error('temporary sheet failure')).mockImplementation(async () => currentSheet);
    renderCharacters();

    expect(await screen.findByRole('link', { name: 'Открыть лист Card hero' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить загрузку' }));
    expect(await screen.findByRole('button', { name: 'Изменить показатель Strength' })).toBeInTheDocument();
    expect(api.getComputedSheet).toHaveBeenCalledTimes(2);
    expect(api.putBaseValue).not.toHaveBeenCalled();
  });

  it('keeps an unknown card write blocked with its draft and does not auto-repeat the PUT', async () => {
    api.putBaseValue.mockRejectedValueOnce(new CampaignApiError(502, { code: 'write_outcome_unknown', title: 'Unknown', detail: 'Unknown' }, true));
    renderCharacters();
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить показатель Strength' }));
    const input = await screen.findByRole('textbox', { name: 'Strength' });
    fireEvent.change(input, { target: { value: '6' } });
    fireEvent.blur(input, { relatedTarget: document.body });

    await waitFor(() => expect(api.putBaseValue).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole('button', { name: 'Проверить данные и права' }));
    await waitFor(() => expect(api.getComputedSheet).toHaveBeenCalledTimes(2));
    expect(api.putBaseValue).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить показатель Strength' }));
    expect(await screen.findByRole('textbox', { name: 'Strength' })).toHaveValue('6');
  });
});
