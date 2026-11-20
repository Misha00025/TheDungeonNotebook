import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ViewEditor from './ViewEditor';

const api = vi.hoisted(() => ({
  getView: vi.fn(),
  getViewContent: vi.fn(),
  getTemplateContent: vi.fn(),
  getTemplateVirtualFields: vi.fn(),
  listCharacters: vi.fn(),
  getComputedSheet: vi.fn(),
  renameView: vi.fn(),
  putViewContent: vi.fn(),
  putPresentation: vi.fn(),
  putCharacterValues: vi.fn(),
}));

vi.mock('./Workspace', () => ({
  useWorkspace: () => ({ api, notifyInvalidation: vi.fn() }),
  useDirtyDraft: vi.fn(),
}));

vi.mock('./PresentationEditor', () => ({
  default: () => null,
}));

const campaignId = 4;
const viewId = '11111111-1111-4111-8111-111111111111';
const characterId = '22222222-2222-4222-8222-222222222222';
const view = { id: viewId, key: '11111111111141118111111111111111', campaignId, name: 'Test', metadataRevision: 7 };
const content = { campaignId, resourceId: viewId, contentRevision: 9, data: { roots: [] } };
const template = { campaignId, contentRevision: 3, data: { description: '', baseFields: [], virtualFields: [] } };
const virtualFields = { contentRevision: 3, virtualFields: [] };
const computedSheet = {
  contentRevision: 9,
  templateContentRevision: 3,
  description: '',
  baseFields: [],
  formulaContentRevisions: [],
  virtualFields: [],
};

const renderEditor = () => render(<ViewEditor campaignId={campaignId} viewId={viewId} canWrite permissionsLoading={false} sessionKey="session" />);

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach(mock => mock.mockReset());
  api.getView.mockResolvedValue(view);
  api.getViewContent.mockResolvedValue(content);
  api.getTemplateContent.mockResolvedValue(template);
  api.getTemplateVirtualFields.mockResolvedValue(virtualFields);
  api.listCharacters.mockResolvedValue([{ id: characterId, name: 'Hero' }]);
  api.getComputedSheet.mockResolvedValue(computedSheet);
  api.renameView.mockResolvedValue({ ...view, name: 'Renamed', metadataRevision: 8 });
});

describe('ViewEditor controls and preview diagnostics', () => {
  it('shows the saved name and sample choice, then saves only metadata with its revision', async () => {
    renderEditor();

    const name = await screen.findByLabelText('Название') as HTMLInputElement;
    const preview = screen.getByLabelText('Предпросмотр') as HTMLSelectElement;
    expect(name).toHaveValue('Test');
    expect(preview).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Образец на основе шаблона' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Отображение: Test' })).not.toBeInTheDocument();
    expect(screen.queryByText('Изменения определения сразу доступны всем назначенным страницам кампании.')).not.toBeInTheDocument();
    expect(screen.queryByText('Образец. Используются типы и названия полей шаблона, игровые значения не загружаются.')).not.toBeInTheDocument();
    expect(api.getTemplateVirtualFields).toHaveBeenCalledWith(campaignId);

    fireEvent.change(name, { target: { value: 'Renamed' } });
    expect(api.renameView).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(api.renameView).toHaveBeenCalledWith(campaignId, viewId, { name: 'Renamed', expectedRevision: 7 }));
    expect(api.putViewContent).not.toHaveBeenCalled();
    expect(api.putPresentation).not.toHaveBeenCalled();
    expect(api.putCharacterValues).not.toHaveBeenCalled();
    expect(api.renameView.mock.calls[0][2]).not.toHaveProperty('roots');
  });

  it('loads a selected character sheet without saving and preserves the name draft when returning to sample', async () => {
    renderEditor();

    const name = await screen.findByLabelText('Название') as HTMLInputElement;
    const preview = screen.getByLabelText('Предпросмотр');
    fireEvent.change(name, { target: { value: 'Draft name' } });
    fireEvent.change(preview, { target: { value: characterId } });
    await waitFor(() => expect(api.getComputedSheet).toHaveBeenCalledWith(campaignId, characterId));

    expect(api.getComputedSheet).toHaveBeenCalledTimes(1);
    expect(api.renameView).not.toHaveBeenCalled();
    expect(api.putViewContent).not.toHaveBeenCalled();
    expect(api.putPresentation).not.toHaveBeenCalled();
    expect(api.putCharacterValues).not.toHaveBeenCalled();

    fireEvent.change(preview, { target: { value: '' } });
    expect(name).toHaveValue('Draft name');
    expect(preview).toHaveValue('');
    expect(api.renameView).not.toHaveBeenCalled();
    expect(api.putViewContent).not.toHaveBeenCalled();
  });

  it('keeps a safe preview error and retries the selected character without losing the name draft', async () => {
    api.getComputedSheet.mockRejectedValueOnce(new Error('private backend detail')).mockResolvedValueOnce(computedSheet);
    renderEditor();

    const name = await screen.findByLabelText('Название') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Draft name' } });
    fireEvent.change(screen.getByLabelText('Предпросмотр'), { target: { value: characterId } });

    expect(await screen.findByText('Не удалось выполнить операцию. Попробуйте ещё раз.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('private backend detail');
    fireEvent.click(screen.getByRole('button', { name: 'Повторить предпросмотр' }));

    await waitFor(() => expect(api.getComputedSheet).toHaveBeenCalledTimes(2));
    expect(api.getComputedSheet).toHaveBeenNthCalledWith(1, campaignId, characterId);
    expect(api.getComputedSheet).toHaveBeenNthCalledWith(2, campaignId, characterId);
    expect(name).toHaveValue('Draft name');
    expect(api.renameView).not.toHaveBeenCalled();
    expect(api.putViewContent).not.toHaveBeenCalled();
    expect(api.putPresentation).not.toHaveBeenCalled();
    expect(api.putCharacterValues).not.toHaveBeenCalled();
  });
});
