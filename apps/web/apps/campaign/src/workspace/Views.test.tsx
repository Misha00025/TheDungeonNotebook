import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Views from './Views';
import { CampaignApiError } from './api';

const api = vi.hoisted(() => ({ listViews: vi.fn(), getView: vi.fn(), getViewContent: vi.fn(), createView: vi.fn() }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, sessionKey: 'session' }), useDirtyState: () => false, useDirtyDraft: () => vi.fn() }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ campaign: { id: 4 }, permissions: { canRead: true, canWrite: true }, lastKnownPermissions: { canRead: true, canWrite: true }, permissionsLoading: false, mode: 'gm' }) }));
vi.mock('./ViewEditor', () => ({ default: () => null }));

const view = { id: 'view-id', key: 'view-key', campaignId: 4, name: 'New view', metadataRevision: 1 };
const content = { campaignId: 4, resourceId: view.id, contentRevision: 2, data: { roots: [] } };
const tree = () => <MemoryRouter initialEntries={['/4/gm/views']}><Routes><Route path=":groupId/gm/views" element={<Views />} /></Routes></MemoryRouter>;

describe('Views creation', () => {
  beforeEach(() => {
    Object.values(api).forEach(mock => mock.mockReset());
    api.listViews.mockResolvedValue([]);
    api.getView.mockImplementation(async (_campaignId: number, id: string) => ({ ...view, id, key: id }));
    api.getViewContent.mockImplementation(async (_campaignId: number, id: string) => ({ ...content, resourceId: id }));
    api.createView.mockResolvedValue({ ...view, contentRevision: content.contentRevision });
  });

  it('does not repost an uncertain creation and verifies using the original request ID', async () => {
    api.createView.mockRejectedValueOnce(new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown', detail: 'Unknown' }, true));
    api.getView.mockRejectedValueOnce(new Error('Not found yet'));
    render(tree());
    fireEvent.click(await screen.findByRole('button', { name: 'Создать отображение' }));
    const dialog = await screen.findByRole('dialog', { name: 'Создать отображение' });
    fireEvent.change(within(dialog).getByLabelText('Название'), { target: { value: 'New view' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Проверить создание' }));
    await waitFor(() => expect(api.getViewContent).toHaveBeenCalledTimes(1));
    const requestId = api.createView.mock.calls[0][1].requestId;
    expect(api.getView).toHaveBeenNthCalledWith(1, 4, requestId);
    expect(api.getView).toHaveBeenNthCalledWith(2, 4, requestId);
    expect(api.getViewContent).toHaveBeenCalledWith(4, requestId);
    expect(api.createView).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Создать отображение' })).not.toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: 'Сохранённое отображение' })).toHaveValue(requestId);
  });

  it('preserves a rejected dirty cancellation until the user confirms', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(tree());
    fireEvent.click(await screen.findByRole('button', { name: 'Создать отображение' }));
    const dialog = await screen.findByRole('dialog', { name: 'Создать отображение' });
    const name = within(dialog).getByLabelText('Название');
    fireEvent.change(name, { target: { value: 'Draft view' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(confirm).toHaveBeenCalledWith('Отказаться от черновика отображения?');
    expect(screen.getByRole('dialog', { name: 'Создать отображение' })).toBeInTheDocument();
    expect(name).toHaveValue('Draft view');
    confirm.mockReturnValue(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Создать отображение' })).not.toBeInTheDocument());
    expect(api.createView).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('keeps a busy creation modal open until the confirmed response arrives', async () => {
    let resolveCreate!: (value: typeof view & { contentRevision: number }) => void;
    api.createView.mockReturnValueOnce(new Promise(resolve => { resolveCreate = resolve; }));
    render(tree());
    fireEvent.click(await screen.findByRole('button', { name: 'Создать отображение' }));
    const dialog = await screen.findByRole('dialog', { name: 'Создать отображение' });
    fireEvent.change(within(dialog).getByLabelText('Название'), { target: { value: 'Busy view' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(api.createView).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeDisabled();
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Создать отображение' })).toBeInTheDocument();
    resolveCreate({ ...view, contentRevision: content.contentRevision });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Создать отображение' })).not.toBeInTheDocument());
    expect(api.createView).toHaveBeenCalledTimes(1);
  });
});
