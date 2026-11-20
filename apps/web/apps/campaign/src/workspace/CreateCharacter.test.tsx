import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreateCharacter from './CreateCharacter';
import { CampaignApiError } from './api';

const shared = vi.hoisted(() => ({ mode: 'gm' as 'gm' | 'player', canWrite: true, permissionsLoading: false, api: { createCharacter: vi.fn(), getCharacter: vi.fn() }, navigate: vi.fn(), close: vi.fn() }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api: shared.api, path: (value: string) => `/app${value}`, navigate: shared.navigate, sessionKey: 'user' }), useDirtyDraft: () => vi.fn() }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ campaign: { id: 4 }, mode: shared.mode, permissions: { canWrite: shared.canWrite && !shared.permissionsLoading }, lastKnownPermissions: { canWrite: shared.canWrite }, permissionsLoading: shared.permissionsLoading }) }));

const character = { id: 'returned-character-guid', campaignId: 4, name: 'Hero', importance: 'Key', metadataRevision: 1 };
const FormHarness: React.FC = () => {
  const [open, setOpen] = React.useState(true);
  return <>{open && <CreateCharacter campaignId={4} onClose={() => { shared.close(); setOpen(false); }} />}</>;
};
const tree = () => <MemoryRouter><FormHarness /></MemoryRouter>;
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
    const dialog = await screen.findByRole('dialog', { name: 'Создать персонажа' });
    expect(within(dialog).getByLabelText('Важность')).toHaveValue('');
    expect(within(dialog).getByRole('option', { name: 'По умолчанию (фоновый)' })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Имя'), { target: { value: ' Hero ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(shared.api.createCharacter).toHaveBeenCalledTimes(1));
    const payload = shared.api.createCharacter.mock.calls[0][1];
    expect(payload).toEqual({ requestId: expect.any(String), name: 'Hero' });
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(shared.navigate).toHaveBeenCalledWith('/app/4/gm/characters/returned-character-guid');
    expect(shared.close).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Создать персонажа' })).not.toBeInTheDocument();
  });

  it('sends an explicitly selected importance without template selectors', async () => {
    renderForm();
    const dialog = await screen.findByRole('dialog', { name: 'Создать персонажа' });
    fireEvent.change(within(dialog).getByLabelText('Имя'), { target: { value: 'Hero' } });
    fireEvent.change(within(dialog).getByLabelText('Важность'), { target: { value: 'Key' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(shared.api.createCharacter).toHaveBeenCalledTimes(1));
    expect(shared.api.createCharacter.mock.calls[0][1]).toEqual({ requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i), name: 'Hero', importance: 'Key' });
  });

  it('keeps request ID fixed while an unknown outcome is checked manually', async () => {
    shared.api.createCharacter.mockRejectedValueOnce(new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown', detail: 'Unknown' }, true));
    shared.api.getCharacter
      .mockRejectedValueOnce(new CampaignApiError(404, { code: 'not_found', title: 'Missing', detail: 'Missing' }))
      .mockRejectedValueOnce(new CampaignApiError(404, { code: 'not_found', title: 'Missing', detail: 'Missing' }));
    renderForm();
    const dialog = await screen.findByRole('dialog', { name: 'Создать персонажа' });
    const name = within(dialog).getByLabelText('Имя');
    fireEvent.change(name, { target: { value: 'Hero' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const escape = new Event('cancel', { cancelable: true });
    fireEvent(dialog, escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledWith('Отказаться от черновика персонажа?');
    expect(screen.getByRole('dialog', { name: 'Создать персонажа' })).toBeInTheDocument();
    expect(name).toHaveValue('Hero');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(name).toHaveValue('Hero');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    await within(dialog).findByRole('button', { name: 'Проверить создание' });
    confirm.mockReturnValue(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    expect(confirm).toHaveBeenLastCalledWith('Отказаться от проверки операции? Результат создания может оставаться неизвестным.');
    expect(screen.getByRole('dialog', { name: 'Создать персонажа' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Проверить создание' }));
    await screen.findByText('Ресурс не найден.');
    const requestId = shared.api.createCharacter.mock.calls[0][1].requestId;
    expect(shared.api.getCharacter).toHaveBeenNthCalledWith(1, 4, requestId);
    expect(shared.api.getCharacter).toHaveBeenNthCalledWith(2, 4, requestId);
    expect(shared.api.createCharacter).toHaveBeenCalledTimes(1);
    expect(shared.navigate).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Проверить создание' }));
    await waitFor(() => expect(shared.navigate).toHaveBeenCalledWith('/app/4/gm/characters/returned-character-guid'));
    expect(shared.api.getCharacter).toHaveBeenNthCalledWith(3, 4, requestId);
    expect(shared.api.createCharacter).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it('blocks modal dismissal while create is busy and closes after successful completion', async () => {
    let resolveCreate!: (value: typeof character) => void;
    shared.api.createCharacter.mockReturnValueOnce(new Promise(resolve => { resolveCreate = resolve; }));
    renderForm();
    const dialog = await screen.findByRole('dialog', { name: 'Создать персонажа' });
    fireEvent.change(within(dialog).getByLabelText('Имя'), { target: { value: 'Hero' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(shared.api.createCharacter).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeDisabled();
    const onClose = new Event('cancel', { cancelable: true });
    fireEvent(dialog, onClose);
    expect(onClose.defaultPrevented).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Создать персонажа' })).toBeInTheDocument();
    resolveCreate(character);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Создать персонажа' })).not.toBeInTheDocument());
    expect(shared.navigate).toHaveBeenCalledWith('/app/4/gm/characters/returned-character-guid');
  });

  it('closes after a confirmed cancellation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderForm();
    const dialog = await screen.findByRole('dialog', { name: 'Создать персонажа' });
    fireEvent.change(within(dialog).getByLabelText('Имя'), { target: { value: 'Draft' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(confirm).toHaveBeenCalledWith('Отказаться от черновика персонажа?');
    expect(screen.queryByRole('dialog', { name: 'Создать персонажа' })).not.toBeInTheDocument();
    expect(shared.api.createCharacter).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('does not load templates or create controls in player mode', () => {
    shared.mode = 'player'; shared.canWrite = false;
    renderForm();
    expect(screen.queryByRole('dialog', { name: 'Создать персонажа' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать персонажа' })).not.toBeInTheDocument();
    expect(shared.api.createCharacter).not.toHaveBeenCalled();
  });

  it('keeps the creation draft mounted while campaign permissions reload', async () => {
    const view = renderForm();
    const dialog = await screen.findByRole('dialog', { name: 'Создать персонажа' });
    fireEvent.change(within(dialog).getByLabelText('Имя'), { target: { value: 'Draft' } });
    shared.permissionsLoading = true;
    view.rerender(tree());
    expect(within(dialog).getByLabelText('Имя')).toHaveValue('Draft');
    expect(within(dialog).getByLabelText('Имя')).toBeDisabled();
    shared.permissionsLoading = false;
    view.rerender(tree());
    expect(within(dialog).getByLabelText('Имя')).toHaveValue('Draft');
    expect(within(dialog).getByLabelText('Имя')).toBeEnabled();
  });

  it('does not navigate when the form unmounts before the create request completes', async () => {
    let resolveCreate!: (value: typeof character) => void;
    shared.api.createCharacter.mockReturnValueOnce(new Promise(resolve => { resolveCreate = resolve; }));
    const view = renderForm();
    const dialog = await screen.findByRole('dialog', { name: 'Создать персонажа' });
    fireEvent.change(within(dialog).getByLabelText('Имя'), { target: { value: 'Hero' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(shared.api.createCharacter).toHaveBeenCalledTimes(1));
    view.unmount();
    resolveCreate(character);
    await waitFor(() => expect(shared.navigate).not.toHaveBeenCalled());
  });
});
