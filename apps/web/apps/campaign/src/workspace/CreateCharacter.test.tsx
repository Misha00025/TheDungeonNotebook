import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreateCharacter from './CreateCharacter';
import { CampaignApiError } from './api';

const shared = vi.hoisted(() => ({ mode: 'gm' as 'gm' | 'player', canWrite: true, permissionsLoading: false, api: { createCharacter: vi.fn(), getCharacter: vi.fn() }, navigate: vi.fn(), close: vi.fn() }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api: shared.api, path: (value: string) => `/app${value}`, navigate: shared.navigate, sessionKey: 'user', invalidation: 0, notifyInvalidation: vi.fn() }), useDirtyDraft: () => vi.fn() }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ campaign: { id: 4 }, mode: shared.mode, permissions: { canWrite: shared.canWrite && !shared.permissionsLoading }, lastKnownPermissions: { canWrite: shared.canWrite }, permissionsLoading: shared.permissionsLoading }) }));

const character = { id: 'returned-character-guid', campaignId: 4, name: 'Hero', importance: 'Key', metadataRevision: 1 };
const tree = () => <MemoryRouter><CreateCharacter campaignId={4} onClose={shared.close} /></MemoryRouter>;
const renderForm = () => render(tree());

describe('CreateCharacter', () => {
  beforeEach(() => {
    shared.mode = 'gm'; shared.canWrite = true; shared.permissionsLoading = false;
    shared.navigate.mockReset(); shared.close.mockReset();
    Object.values(shared.api).forEach(method => method.mockReset());
    shared.api.createCharacter.mockResolvedValue(character);
    shared.api.getCharacter.mockResolvedValue(character);
  });

  it('creates without optional importance and sends only the singleton character fields', async () => {
    renderForm();
    expect(screen.getByLabelText('Важность')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'По умолчанию (фоновый)' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: ' Hero ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(shared.api.createCharacter).toHaveBeenCalledTimes(1));
    const payload = shared.api.createCharacter.mock.calls[0][1];
    expect(payload).toEqual({ requestId: expect.any(String), name: 'Hero' });
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(shared.navigate).toHaveBeenCalledWith('/app/4/gm/characters/returned-character-guid/overview');
    expect(shared.close).toHaveBeenCalledTimes(1);
  });

  it('sends an explicitly selected importance without template selectors', async () => {
    renderForm();
    fireEvent.change(await screen.findByLabelText('Имя'), { target: { value: 'Hero' } });
    fireEvent.change(screen.getByLabelText('Важность'), { target: { value: 'Key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(shared.api.createCharacter).toHaveBeenCalledTimes(1));
    expect(shared.api.createCharacter.mock.calls[0][1]).toEqual({ requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i), name: 'Hero', importance: 'Key' });
  });

  it('keeps request ID fixed while an unknown outcome is checked manually', async () => {
    shared.api.createCharacter.mockRejectedValueOnce(new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown', detail: 'Unknown' }, true));
    shared.api.getCharacter
      .mockRejectedValueOnce(new CampaignApiError(404, { code: 'not_found', title: 'Missing', detail: 'Missing' }))
      .mockRejectedValueOnce(new CampaignApiError(404, { code: 'not_found', title: 'Missing', detail: 'Missing' }));
    renderForm();
    fireEvent.change(await screen.findByLabelText('Имя'), { target: { value: 'Hero' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    await screen.findByRole('button', { name: 'Проверить создание' });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить создание' }));
    await screen.findByText('Missing');
    const requestId = shared.api.createCharacter.mock.calls[0][1].requestId;
    expect(shared.api.getCharacter).toHaveBeenNthCalledWith(1, 4, requestId);
    expect(shared.api.getCharacter).toHaveBeenNthCalledWith(2, 4, requestId);
    expect(shared.api.createCharacter).toHaveBeenCalledTimes(1);
    expect(shared.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Проверить создание' }));
    await waitFor(() => expect(shared.navigate).toHaveBeenCalledWith('/app/4/gm/characters/returned-character-guid/overview'));
    expect(shared.api.getCharacter).toHaveBeenNthCalledWith(3, 4, requestId);
    expect(shared.api.createCharacter).toHaveBeenCalledTimes(1);
  });

  it('does not load templates or create controls in player mode', () => {
    shared.mode = 'player'; shared.canWrite = false;
    const { container } = renderForm();
    expect(container).toBeEmptyDOMElement();
    expect(shared.api.createCharacter).not.toHaveBeenCalled();
  });

  it('keeps the creation draft mounted while campaign permissions reload', async () => {
    const view = renderForm();
    fireEvent.change(await screen.findByLabelText('Имя'), { target: { value: 'Draft' } });
    shared.permissionsLoading = true;
    view.rerender(tree());
    expect(screen.getByLabelText('Имя')).toHaveValue('Draft');
    expect(screen.getByLabelText('Имя')).toBeDisabled();
    shared.permissionsLoading = false;
    view.rerender(tree());
    expect(screen.getByLabelText('Имя')).toHaveValue('Draft');
    expect(screen.getByLabelText('Имя')).toBeEnabled();
  });

  it('does not navigate when the form unmounts before the create request completes', async () => {
    let resolveCreate!: (value: typeof character) => void;
    shared.api.createCharacter.mockReturnValueOnce(new Promise(resolve => { resolveCreate = resolve; }));
    const view = renderForm();
    fireEvent.change(await screen.findByLabelText('Имя'), { target: { value: 'Hero' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(shared.api.createCharacter).toHaveBeenCalledTimes(1));
    view.unmount();
    resolveCreate(character);
    await waitFor(() => expect(shared.navigate).not.toHaveBeenCalled());
  });
});
