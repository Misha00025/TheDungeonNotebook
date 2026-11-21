import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewMetadata } from './types';
import type { PresentationNode } from './presentationModel';
import { CampaignApiError } from './api';
import ViewEditor from './ViewEditor';

const api = vi.hoisted(() => ({
  getView: vi.fn(),
  getViewContent: vi.fn(),
  getTemplateContent: vi.fn(),
  getTemplateVirtualFields: vi.fn(),
  listCharacters: vi.fn(),
  getComputedSheet: vi.fn(),
  getPresentation: vi.fn(),
  renameView: vi.fn(),
  putViewContent: vi.fn(),
  putPresentation: vi.fn(),
  putCharacterValues: vi.fn(),
}));

vi.mock('./Workspace', () => ({
  useWorkspace: () => ({ api }),
  useDirtyDraft: vi.fn(),
}));

vi.mock('./PresentationEditor', () => ({
  default: ({ roots, onChange, surface }: { roots: PresentationNode[]; onChange: (next: PresentationNode[]) => void; surface?: 'page' | 'header' | 'card' }) => <div><span>{roots.map(root => root.title).join(',')}</span><span>Working surface: {surface ?? 'page'}</span><button type="button" onClick={() => onChange([...roots, { kind: 'layout', nodeKey: 'draft-root', title: 'Draft root', params: null, children: [] }])}>Change roots</button></div>,
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
const presentation = { contentRevision: 11, defaults: {}, contextParams: {} };

const renderEditor = (onMetadataChange?: (metadata: ViewMetadata) => void, initialSurface?: 'page' | 'header' | 'card') => render(<ViewEditor campaignId={campaignId} viewId={viewId} canWrite permissionsLoading={false} sessionKey="session" initialSurface={initialSurface} onMetadataChange={onMetadataChange} />);

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach(mock => mock.mockReset());
  api.getView.mockResolvedValue(view);
  api.getViewContent.mockResolvedValue(content);
  api.getTemplateContent.mockResolvedValue(template);
  api.getTemplateVirtualFields.mockResolvedValue(virtualFields);
  api.listCharacters.mockResolvedValue([{ id: characterId, name: 'Hero' }]);
  api.getComputedSheet.mockResolvedValue(computedSheet);
  api.getPresentation.mockResolvedValue(presentation);
  api.renameView.mockResolvedValue({ ...view, name: 'Renamed', metadataRevision: 8 });
});

describe('ViewEditor controls and preview diagnostics', () => {
  it('shows the saved name and sample choice, then saves only metadata with its revision', async () => {
    const onMetadataChange = vi.fn();
    renderEditor(onMetadataChange);

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
    await waitFor(() => expect(onMetadataChange).toHaveBeenCalledWith({ ...view, name: 'Renamed', metadataRevision: 8 }));
    expect(onMetadataChange).toHaveBeenCalledTimes(1);
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

  it('retains a conflicted content draft until explicit verification', async () => {
    api.putViewContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'conflict', title: 'Conflict', detail: 'Conflict' }));
    api.getViewContent.mockResolvedValueOnce(content).mockResolvedValueOnce({ ...content, contentRevision: 10, data: { roots: [] } });
    renderEditor();
    await screen.findByLabelText('Название');
    fireEvent.click(screen.getByRole('button', { name: 'Change roots' }));
    expect(screen.getByText('Draft root')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByRole('button', { name: 'Проверить сохранение' })).toBeInTheDocument();
    expect(api.putViewContent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Проверить сохранение' }));
    await waitFor(() => expect(api.getViewContent).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Серверное дерево содержит 0 корневых компонентов.')).toBeInTheDocument();
    expect(screen.getByText('Draft root')).toBeInTheDocument();
    expect(api.putViewContent).toHaveBeenCalledTimes(1);
  });

  it('saves the selected surface separately and restores it from the view descriptor', async () => {
    const original = { contentRevision: 11, defaults: { future: 'unchanged' }, contextParams: { unrelated: { keep: false } } };
    const stored = { contentRevision: 12, defaults: { future: 'unchanged' }, contextParams: { unrelated: { keep: false }, [`view_${view.key}`]: { editorSurface: 'card' } } };
    api.getPresentation.mockResolvedValueOnce(original);
    api.putPresentation.mockResolvedValue(stored);
    const first = renderEditor(undefined, 'card');

    const assignment = await screen.findByLabelText('Назначение');
    expect(assignment).toHaveValue('card');
    expect(screen.getByText('Working surface: card')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(api.putPresentation).toHaveBeenCalledWith(campaignId, {
      expectedRevision: 11,
      defaults: { future: 'unchanged' },
      contextParams: { unrelated: { keep: false }, [`view_${view.key}`]: { editorSurface: 'card' } },
    }));
    expect(api.putViewContent).not.toHaveBeenCalled();
    expect(api.renameView).not.toHaveBeenCalled();

    api.getPresentation.mockResolvedValue(stored);
    first.unmount();
    renderEditor();
    expect(await screen.findByLabelText('Назначение')).toHaveValue('card');
  });

  it('keeps a conflicted surface draft and never repeats its write before explicit verification', async () => {
    const server = { contentRevision: 14, defaults: { unchanged: 'view' }, contextParams: { [`view_${view.key}`]: { editorSurface: 'page', keep: 'yes' } } };
    api.getPresentation.mockResolvedValueOnce(presentation).mockResolvedValueOnce(server);
    api.putPresentation.mockRejectedValueOnce(new CampaignApiError(502, { code: 'write_outcome_unknown', title: 'Unknown', detail: 'Unknown' }, true));
    renderEditor(undefined, 'card');

    expect(await screen.findByText('Working surface: card')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Проверить сохранение' }));
    expect(await screen.findByText('Серверный формат: Страница персонажа.')).toBeInTheDocument();
    expect(screen.getByText('Working surface: card')).toBeInTheDocument();
    expect(api.putPresentation).toHaveBeenCalledTimes(1);
    expect(api.putViewContent).not.toHaveBeenCalled();
  });
});
