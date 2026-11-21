import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HeroImportWizard from './HeroImportWizard';
import { CampaignApiError } from './api';
import type { LegacyObject } from './legacyDiscovery';

const shared = vi.hoisted(() => ({
  mode: 'gm' as 'gm' | 'player',
  canWrite: true,
  permissionsLoading: false,
  api: {
    getTemplateContent: vi.fn(), listCharacters: vi.fn(), characterPermissions: vi.fn(), getCharacter: vi.fn(), getSheet: vi.fn(),
    createCharacter: vi.fn(), putCharacter: vi.fn(), putDescription: vi.fn(), putBaseValue: vi.fn(), putTemplateContent: vi.fn(), putAssignment: vi.fn()
  },
  close: vi.fn()
}));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api: shared.api, path: (value: string) => `/app${value}`, sessionKey: 'user' }), useDirtyDraft: () => vi.fn() }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ mode: shared.mode, permissions: { canWrite: shared.canWrite }, permissionsLoading: shared.permissionsLoading, reloadPermissions: vi.fn() }) }));

const template = {
  campaignId: 4,
  contentRevision: 7,
  data: {
    description: 'template description',
    baseFields: [
      { id: 'power-id', key: 'power', title: 'Power', description: '', valueType: 'Integer', typeRevision: 1, value: 0, options: [] },
      { id: 'stamina-id', key: 'stamina', title: 'Stamina', description: '', valueType: 'String', typeRevision: 1, value: '', options: [] }
    ],
    virtualFields: []
  }
};
const targetMetadata = { id: 'target-id', campaignId: 4, name: 'Existing target', importance: 'Key', metadataRevision: 3 };
const targetSheet = (contentRevision = 5) => ({
  contentRevision, templateContentRevision: 7, description: 'Old description',
  baseFields: template.data.baseFields.map(field => ({ ...field, effectiveValue: field.value, isExplicit: true }))
});
const source = (name: string, fields: LegacyObject['fields'] = [], data: Record<string, unknown> = {}): LegacyObject => ({
  name, sourceId: 'legacy-id-not-target', data: { name, ...data } as LegacyObject['data'], fields, properties: []
});
const legacyField = (key: string, name: string, value: LegacyObject['data'][string]) => ({ key, name, data: { value } });
const renderWizard = (sources: LegacyObject[]) => render(<MemoryRouter><HeroImportWizard sources={sources} campaignId={4} onClose={shared.close} /></MemoryRouter>);
const resetApi = () => {
  Object.values(shared.api).forEach(method => method.mockReset());
  shared.api.getTemplateContent.mockResolvedValue(template);
  shared.api.listCharacters.mockResolvedValue([targetMetadata]);
  shared.api.characterPermissions.mockResolvedValue({ canRead: true, canWrite: true, canManageAccess: false });
  shared.api.getCharacter.mockResolvedValue(targetMetadata);
  shared.api.getSheet.mockResolvedValue(targetSheet());
  shared.api.createCharacter.mockImplementation(async (_campaignId: number, body: { requestId: string; name: string; importance?: string }) => ({ id: body.requestId, campaignId: 4, name: body.name, importance: body.importance ?? 'Background', metadataRevision: 1 }));
  shared.api.putCharacter.mockResolvedValue({ ...targetMetadata, metadataRevision: 4 });
  shared.api.putDescription.mockResolvedValue({ contentRevision: 6 });
  shared.api.putBaseValue.mockResolvedValue(targetSheet(7));
};

describe('HeroImportWizard', () => {
  beforeEach(() => {
    shared.mode = 'gm'; shared.canWrite = true; shared.permissionsLoading = false; shared.close.mockReset(); resetApi();
  });

  it('previews one selected hero and writes only confirmed description and mapped fields', async () => {
    const hero = source('Hero', [legacyField('power', 'Power source', 18), legacyField('stamina', 'Stamina source', 'fit'), legacyField('unknown', 'Legacy field', 99)], { description: 'New description', formula: 'do not import' });
    const ignored = source('Ignored hero', [legacyField('power', 'Other power', 40)]);
    renderWizard([hero, ignored]);
    const dialog = await screen.findByRole('dialog', { name: 'Импорт персонажа' });
    fireEvent.change(within(dialog).getByLabelText('Персонаж из файла'), { target: { value: '0' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Далее' }));
    fireEvent.click(within(dialog).getByLabelText('Описание Hero'));
    fireEvent.click(within(dialog).getByLabelText('Поля Hero'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Далее' }));

    await waitFor(() => expect(within(dialog).getByLabelText('Цель для Hero')).toBeEnabled());
    fireEvent.change(within(dialog).getByLabelText('Цель для Hero'), { target: { value: 'existing' } });
    await waitFor(() => expect(within(dialog).getByLabelText('Существующий персонаж для Hero')).toBeEnabled());
    fireEvent.change(within(dialog).getByLabelText('Существующий персонаж для Hero'), { target: { value: 'target-id' } });
    await waitFor(() => expect(within(dialog).getByLabelText('Действие Hero: Power source')).toHaveValue('replace'));
    expect(within(dialog).getByLabelText('Действие Hero: Legacy field')).toHaveValue('skip');
    expect(within(dialog).getByLabelText('Действие Hero: Stamina source')).toHaveValue('replace');
    fireEvent.change(within(dialog).getByLabelText('Действие Hero: Stamina source'), { target: { value: 'skip' } });
    fireEvent.change(within(dialog).getByLabelText('Действие для описания Hero'), { target: { value: 'replace' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Далее' }));

    expect(within(dialog).getByText('Hero')).toBeInTheDocument();
    expect(within(dialog).getByText(/В существующего: Existing target/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Power source → Power:.*18/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Описание:.*Old description.*New description/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/Ignored hero/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Stamina source/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/do not import/)).not.toBeInTheDocument();
    expect(shared.api.createCharacter).not.toHaveBeenCalled();
    expect(shared.api.putCharacter).not.toHaveBeenCalled();
    expect(shared.api.putDescription).not.toHaveBeenCalled();
    expect(shared.api.putBaseValue).not.toHaveBeenCalled();
    expect(shared.api.putTemplateContent).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Подтвердить импорт' }));
    await waitFor(() => expect(shared.api.putBaseValue).toHaveBeenCalledTimes(1));
    expect(shared.api.putDescription).toHaveBeenCalledWith(4, 'target-id', { description: 'New description', expectedRevision: 5 });
    expect(shared.api.putBaseValue).toHaveBeenCalledWith(4, 'target-id', 'power-id', { value: 18, expectedRevision: 6 });
    expect(shared.api.putCharacter).not.toHaveBeenCalled();
    expect(shared.api.createCharacter).not.toHaveBeenCalled();
    expect(shared.api.putTemplateContent).not.toHaveBeenCalled();
    expect(shared.api.putAssignment).not.toHaveBeenCalled();
  });

  it('rechecks an unknown create by the same request ID and does not post it again', async () => {
    const hero = source('Solo', [], {});
    shared.api.createCharacter.mockRejectedValueOnce(new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown', detail: 'Unknown' }, true));
    shared.api.getCharacter
      .mockRejectedValueOnce(new CampaignApiError(404, { code: 'not_found', title: 'Missing', detail: 'Missing' }))
      .mockImplementation(async (_campaignId: number, id: string) => ({ ...targetMetadata, id, name: 'Solo' }));
    renderWizard([hero]);
    const dialog = await screen.findByRole('dialog', { name: 'Импорт персонажа' });
    fireEvent.change(within(dialog).getByLabelText('Персонаж из файла'), { target: { value: '0' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Далее' }));
    fireEvent.click(within(dialog).getByLabelText('Имя Solo'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Далее' }));
    await waitFor(() => expect(within(dialog).getByLabelText('Цель для Solo')).toBeEnabled());
    fireEvent.change(within(dialog).getByLabelText('Цель для Solo'), { target: { value: 'new' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Далее' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Подтвердить импорт' }));
    await waitFor(() => expect(shared.api.createCharacter).toHaveBeenCalledTimes(1));
    const requestId = shared.api.createCharacter.mock.calls[0][1].requestId;

    const recheckButton = await within(dialog).findByRole('button', { name: 'Перечитать данные' });
    fireEvent.click(recheckButton);
    await waitFor(() => expect(shared.api.getCharacter).toHaveBeenCalledWith(4, requestId));
    expect(shared.api.createCharacter).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Перечитать данные' })).toBeEnabled());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Перечитать данные' }));
    await waitFor(() => expect(within(dialog).getByText(/Текущее состояние перечитано/)).toBeInTheDocument());
    expect(shared.api.getCharacter).toHaveBeenLastCalledWith(4, requestId);
    expect(shared.api.createCharacter).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Далее' }));
    expect(within(dialog).getByText(/Создан: Solo/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Подтвердить импорт' })).toBeDisabled();
    expect(shared.api.createCharacter).toHaveBeenCalledTimes(1);
  });
});
