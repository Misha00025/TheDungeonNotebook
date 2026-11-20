import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { isLosslessNumber, LosslessNumber } from 'lossless-json';
import Templates from './Templates';
import { CampaignApiError } from './api';
import type { BaseField, BaseFieldInput, TemplateContentEnvelope, VirtualField, VirtualFieldInput } from './types';

const shared = vi.hoisted(() => ({ dirty: false, canWrite: true, permissionsLoading: false, sessionKey: 'user' }));
const api = vi.hoisted(() => ({ listFormulas: vi.fn(), getFormulaContent: vi.fn(), getTemplate: vi.fn(), getTemplateContent: vi.fn(), renameTemplate: vi.fn(), putTemplateContent: vi.fn(), putTemplateVirtualFields: vi.fn() }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, sessionKey: shared.sessionKey }), useDirtyDraft: (_owner: string, dirty: boolean) => { shared.dirty = dirty; return () => { shared.dirty = false; }; } }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ campaign: { id: 4 }, permissions: { canWrite: shared.canWrite }, lastKnownPermissions: { canWrite: shared.canWrite }, permissionsLoading: shared.permissionsLoading }) }));

const base = (id: string, key: string, title = key, value: BaseField['value'] = 0): BaseField => ({ id, key, title, description: `description ${key}`, valueType: 'Number', typeRevision: 5, value, options: [] });
const virtual = (id: string, key: string, title = key): VirtualField => ({ id, key, title, description: `description ${key}`, resultType: 'Number', formulaId: 'formula', bindings: {} });
const content = (revision = 11, baseFields: BaseField[] = [base('base-a', 'a', 'Alpha'), base('base-b', 'b', 'Beta')], virtualFields: VirtualField[] = [virtual('virtual-a', 'v', 'Virtual')], description = 'passive\ndescription'): TemplateContentEnvelope => ({ campaignId: 4, contentRevision: revision, data: { description, baseFields, virtualFields } });
let serverContent: TemplateContentEnvelope;

const RouteChange: React.FC = () => { const navigate = useNavigate(); return <button type="button" onClick={() => navigate('/5/gm/templates')}>Другую кампанию</button>; };
const tree = (path = '/4/gm/templates') => <MemoryRouter initialEntries={[path]}><RouteChange /><Routes><Route path=":groupId/gm/templates" element={<Templates />} /></Routes></MemoryRouter>;
const renderTemplates = (path?: string) => render(tree(path));
const baseRow = (label: string) => screen.getByRole('row', { name: `Базовое поле ${label}` });
const virtualRow = (label: string) => screen.getByRole('row', { name: `Виртуальное поле ${label}` });
const baseTitle = (label: string) => within(baseRow(label)).getByRole('textbox', { name: `Название базового поля ${label}` });
const virtualTitle = (label: string) => within(virtualRow(label)).getByRole('textbox', { name: `Название виртуального поля ${label}` });
const globalSaveButton = () => screen.getByRole('button', { name: 'Сохранить' });
const globalCancelButton = () => screen.getByRole('button', { name: 'Отменить' });
const baseDelete = (label: string) => within(baseRow(label)).getByRole('button', { name: `Удалить базовое поле ${label}` });
const virtualDelete = (label: string) => within(virtualRow(label)).getByRole('button', { name: `Удалить виртуальное поле ${label}` });

describe('singleton campaign template editor', () => {
  beforeEach(() => {
    shared.dirty = false;
    shared.canWrite = true;
    shared.permissionsLoading = false;
    shared.sessionKey = 'user';
    Object.values(api).forEach(method => method.mockReset());
    serverContent = content();
    api.getTemplateContent.mockImplementation(async () => serverContent);
    api.listFormulas.mockResolvedValue([{ id: 'formula', key: 'f', campaignId: 4, name: 'Formula', metadataRevision: 1 }]);
    api.getFormulaContent.mockResolvedValue({ campaignId: 4, resourceId: 'formula', contentRevision: 1, data: { expression: '', parameters: [] } });
    api.putTemplateContent.mockImplementation(async (_id: number, body: { expectedRevision: number; description: string; baseFields: BaseFieldInput[] }) => {
      serverContent = {
        ...serverContent,
        contentRevision: body.expectedRevision + 1,
        data: {
          ...serverContent.data,
          description: body.description,
          baseFields: body.baseFields.map((field, index) => ({ ...field, id: field.id ?? `created-base-${index}`, typeRevision: 1 })),
        },
      };
      return serverContent;
    });
    api.putTemplateVirtualFields.mockImplementation(async (_id: number, body: { expectedRevision: number; virtualFields: VirtualFieldInput[] }) => {
      const virtualFields = body.virtualFields.map((field, index) => ({ ...field, id: field.id ?? `created-virtual-${index}` }));
      serverContent = { ...serverContent, contentRevision: body.expectedRevision + 1, data: { ...serverContent.data, virtualFields } };
      return { contentRevision: serverContent.contentRevision, virtualFields };
    });
  });

  it('keeps the header visible while loading and after initial read failure', async () => {
    api.getTemplateContent.mockReturnValueOnce(new Promise(() => {}));
    const loading = renderTemplates();
    expect(globalSaveButton()).toBeDisabled();
    expect(globalCancelButton()).toBeDisabled();
    expect(screen.getByText('Загрузка шаблона…')).toBeInTheDocument();
    loading.unmount();
    api.getTemplateContent.mockRejectedValueOnce(new Error('initial read failed'));
    renderTemplates();
    expect(await screen.findByRole('button', { name: 'Повторить загрузку' })).toBeInTheDocument();
    expect(globalSaveButton()).toBeDisabled();
    expect(globalCancelButton()).toBeDisabled();
  });

  it('loads both field groups, retains baseline values, and keeps metadata editing unavailable', async () => {
    renderTemplates();
    expect(await screen.findByLabelText('Название базового поля Alpha')).toHaveValue('Alpha');
    expect(await screen.findByLabelText('Название виртуального поля Virtual')).toHaveValue('Virtual');
    expect(globalSaveButton()).toBeDisabled();
    expect(globalCancelButton()).toBeDisabled();
    expect(within(baseRow('Alpha')).getByRole('combobox', { name: 'Тип базового поля Alpha' })).toHaveValue('Number');
    expect(within(virtualRow('Virtual')).getByRole('combobox', { name: 'Тип виртуального поля Virtual' })).toHaveValue('Number');
    expect(within(baseRow('Alpha')).getByRole('textbox', { name: 'Ключ базового поля Alpha' })).toBeDisabled();
    expect(api.getTemplateContent).toHaveBeenCalledWith(4);
    await waitFor(() => expect(api.listFormulas).toHaveBeenCalledWith(4));
    expect(api.getTemplate).not.toHaveBeenCalled();
    expect(api.renameTemplate).not.toHaveBeenCalled();
  });

  it.each([
    { kind: 'base', addName: 'Добавить поле', label: 'Базовое поле', titleLabel: 'Название базового поля', keyLabel: 'Ключ базового поля', existing: 'Alpha' },
    { kind: 'virtual', addName: 'Добавить виртуальное поле', label: 'Виртуальное поле', titleLabel: 'Название виртуального поля', keyLabel: 'Ключ виртуального поля', existing: 'Virtual' },
  ])('defers deletion and restores an edited draft for $kind rows', async config => {
    const confirm = vi.spyOn(window, 'confirm');
    renderTemplates();
    await screen.findByLabelText(`${config.titleLabel} ${config.existing}`);
    const rowFor = (label: string) => screen.getByRole('row', { name: `${config.label} ${label}` });
    const titleFor = (label: string) => within(rowFor(label)).getByRole('textbox', { name: `${config.titleLabel} ${label}` });
    const deleteFor = (label: string) => within(rowFor(label)).getByRole('button', { name: `Удалить ${config.kind === 'base' ? 'базовое' : 'виртуальное'} поле ${label}` });
    const existingTitle = titleFor(config.existing);
    fireEvent.change(existingTitle, { target: { value: 'Edited' } });
    expect(globalSaveButton()).toBeEnabled();
    fireEvent.change(titleFor('Edited'), { target: { value: config.existing } });
    expect(globalSaveButton()).toBeDisabled();

    fireEvent.change(titleFor(config.existing), { target: { value: 'Edited again' } });
    fireEvent.click(screen.getByRole('button', { name: config.addName }));
    const added = rowFor('Новое поле');
    if (config.kind === 'base') {
      expect(within(added).getByRole('combobox', { name: 'Тип базового поля Новое поле' })).toHaveValue('Integer');
      expect(within(added).getByRole('textbox', { name: 'Значение по умолчанию Новое поле' })).toHaveValue('0');
    } else {
      expect(within(added).getByRole('combobox', { name: 'Тип виртуального поля Новое поле' })).toHaveValue('Integer');
    }
    fireEvent.change(within(added).getByRole('textbox', { name: `${config.titleLabel} Новое поле` }), { target: { value: 'Added draft' } });
    expect(titleFor('Added draft')).toHaveValue('Added draft');

    fireEvent.click(deleteFor('Edited again'));
    expect(confirm).not.toHaveBeenCalled();
    const row = rowFor('Edited again');
    expect(within(row).getByRole('textbox', { name: `${config.titleLabel} Edited again` })).toBeDisabled();
    expect(within(row).queryByRole('button', { name: /Сохранить|Отменить изменения/ })).not.toBeInTheDocument();
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    const undo = within(row).getByRole('button', { name: `Восстановить ${config.kind === 'base' ? 'базовое' : 'виртуальное'} поле Edited again` });
    fireEvent.click(undo);
    expect(titleFor('Edited again')).toHaveValue('Edited again');
    expect(titleFor('Edited again')).toBeEnabled();

    fireEvent.click(deleteFor('Added draft'));
    expect(screen.queryByRole('textbox', { name: `${config.titleLabel} Added draft` })).not.toBeInTheDocument();
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('globally cancels every draft, tombstone, addition, and invalid raw value only after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTemplates();
    await screen.findByLabelText('Название базового поля Alpha');
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Alpha draft' } });
    fireEvent.change(virtualTitle('Virtual'), { target: { value: 'Virtual draft' } });
    fireEvent.change(within(baseRow('Beta')).getByRole('textbox', { name: 'Значение по умолчанию Beta' }), { target: { value: '-' } });
    fireEvent.click(baseDelete('Beta'));
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    fireEvent.change(within(baseRow('Новое поле')).getByRole('textbox', { name: 'Ключ базового поля Новое поле' }), { target: { value: 'new' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить виртуальное поле' }));
    fireEvent.change(within(virtualRow('Новое поле')).getByRole('textbox', { name: 'Ключ виртуального поля Новое поле' }), { target: { value: 'new-v' } });
    expect(globalSaveButton()).toBeDisabled();
    fireEvent.click(globalCancelButton());
    expect(confirm).toHaveBeenCalledWith('Отменить все изменения шаблона?');
    expect(baseTitle('Alpha draft')).toHaveValue('Alpha draft');
    expect(virtualTitle('Virtual draft')).toHaveValue('Virtual draft');
    expect(within(baseRow('Beta')).getByRole('textbox', { name: 'Название базового поля Beta' })).toBeDisabled();
    expect(within(baseRow('Beta')).getByRole('button', { name: 'Восстановить базовое поле Beta' })).toBeEnabled();
    confirm.mockReturnValue(true);
    fireEvent.click(globalCancelButton());
    expect(baseTitle('Alpha')).toHaveValue('Alpha');
    expect(virtualTitle('Virtual')).toHaveValue('Virtual');
    expect(within(baseRow('Beta')).getByRole('textbox', { name: 'Значение по умолчанию Beta' })).toHaveValue('0');
    expect(baseTitle('Alpha')).toBeEnabled();
    expect(virtualTitle('Virtual')).toBeEnabled();
    expect(screen.queryByRole('textbox', { name: 'Название базового поля Новое поле' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Название виртуального поля Новое поле' })).not.toBeInTheDocument();
    expect(globalSaveButton()).toBeDisabled();
    expect(globalCancelButton()).toBeDisabled();
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('globally saves complete active base then virtual arrays using the returned revision', async () => {
    renderTemplates();
    await screen.findByLabelText('Название базового поля Alpha');
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Alpha changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    const newBase = baseRow('Новое поле');
    const newBaseKey = within(newBase).getByRole('textbox', { name: 'Ключ базового поля Новое поле' });
    const newBaseTitle = within(newBase).getByRole('textbox', { name: 'Название базового поля Новое поле' });
    fireEvent.change(newBaseKey, { target: { value: 'c' } });
    fireEvent.change(newBaseTitle, { target: { value: 'Gamma' } });
    fireEvent.click(baseDelete('Beta'));
    fireEvent.change(virtualTitle('Virtual'), { target: { value: 'Virtual changed' } });
    fireEvent.click(globalSaveButton());
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1));
    expect(api.putTemplateContent.mock.invocationCallOrder[0]).toBeLessThan(api.putTemplateVirtualFields.mock.invocationCallOrder[0]);
    expect(api.putTemplateContent.mock.calls[0][1]).toMatchObject({ expectedRevision: 11, description: 'passive\ndescription' });
    expect(api.putTemplateContent.mock.calls[0][1].baseFields).toEqual([
      expect.objectContaining({ id: 'base-a', title: 'Alpha changed' }),
      expect.objectContaining({ key: 'c', title: 'Gamma' }),
    ]);
    expect(api.putTemplateVirtualFields.mock.calls[0][1]).toMatchObject({ expectedRevision: 12, virtualFields: [expect.objectContaining({ id: 'virtual-a', title: 'Virtual changed' })] });
    expect(api.putTemplateContent.mock.calls[0][1].baseFields[0]).not.toHaveProperty('typeRevision');
    expect(api.putTemplateContent.mock.calls[0][1].baseFields[1]).not.toHaveProperty('typeRevision');
    expect(await screen.findByText('Изменения шаблона сохранены.')).toBeInTheDocument();
    expect(within(baseRow('Gamma')).getByRole('textbox', { name: 'Ключ базового поля Gamma' })).toBeDisabled();
    expect(globalSaveButton()).toBeDisabled();
    expect(globalCancelButton()).toBeDisabled();
  });

  it.each([
    { kind: 'base' as const, first: 'Alpha', second: 'Beta' },
    { kind: 'virtual' as const, first: 'Virtual', second: 'Second virtual' },
  ])('reorders $kind rows locally and saves the complete ordered group', async ({ kind, first, second }) => {
    serverContent = content(11, undefined, [virtual('virtual-a', 'v', 'Virtual'), virtual('virtual-b', 'w', 'Second virtual')]);
    renderTemplates();
    await screen.findByLabelText('Название базового поля Alpha');
    const titleFor = (label: string) => kind === 'base' ? baseTitle(label) : virtualTitle(label);
    fireEvent.change(titleFor(first), { target: { value: 'Edited' } });
    const changedLabel = 'Edited';
    if (kind === 'base') fireEvent.change(within(baseRow(changedLabel)).getByRole('textbox', { name: 'Значение по умолчанию Edited' }), { target: { value: '42' } });
    const source = screen.getByRole('button', { name: `Переместить ${kind === 'base' ? 'базовое' : 'виртуальное'} поле ${changedLabel}` });
    const target = kind === 'base' ? baseRow(second) : virtualRow(second);
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(source, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', expect.any(String));
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(globalSaveButton()).toBeEnabled();
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    fireEvent.click(globalSaveButton());
    if (kind === 'base') {
      await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
      const fields = api.putTemplateContent.mock.calls[0][1].baseFields;
      expect(fields.map((field: BaseFieldInput) => field.id)).toEqual(['base-b', 'base-a']);
      expect(fields[1]).toMatchObject({ id: 'base-a', title: 'Edited' });
      expect(isLosslessNumber(fields[1].value)).toBe(true);
      expect(String(fields[1].value)).toBe('42');
      expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    } else {
      await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1));
      const fields = api.putTemplateVirtualFields.mock.calls[0][1].virtualFields;
      expect(fields.map((field: VirtualFieldInput) => field.id)).toEqual(['virtual-b', 'virtual-a']);
      expect(fields[1]).toMatchObject({ id: 'virtual-a', title: 'Edited' });
      expect(api.putTemplateContent).not.toHaveBeenCalled();
    }
  });

  it('does not reorder on aborted, cross-group, or external drags', async () => {
    serverContent = content(11, undefined, [virtual('virtual-a', 'v', 'Virtual'), virtual('virtual-b', 'w', 'Second virtual')]);
    renderTemplates();
    await screen.findByLabelText('Название базового поля Alpha');
    const alphaHandle = screen.getByRole('button', { name: 'Переместить базовое поле Alpha' });
    const virtualTarget = virtualRow('Virtual');
    const transfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(alphaHandle, { dataTransfer: transfer });
    fireEvent.dragOver(baseRow('Beta'), { dataTransfer: transfer });
    fireEvent.dragEnd(alphaHandle, { dataTransfer: transfer });
    expect(globalSaveButton()).toBeDisabled();
    fireEvent.dragStart(alphaHandle, { dataTransfer: transfer });
    fireEvent.drop(virtualTarget, { dataTransfer: transfer });
    expect(globalSaveButton()).toBeDisabled();
    fireEvent.dragOver(baseRow('Beta'), { dataTransfer: transfer });
    fireEvent.drop(baseRow('Beta'), { dataTransfer: transfer });
    expect(globalSaveButton()).toBeDisabled();
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
  });

  it('moves rows with arrow keys, honors boundaries, and skips deleted rows', async () => {
    serverContent = content(11, [base('base-a', 'a', 'Alpha'), base('base-b', 'b', 'Beta'), base('base-c', 'c', 'Gamma')], []);
    renderTemplates();
    await screen.findByLabelText('Название базового поля Alpha');
    const handle = (label: string) => screen.getByRole('button', { name: `Переместить базовое поле ${label}` });
    fireEvent.keyDown(handle('Alpha'), { key: 'ArrowUp' });
    expect(globalSaveButton()).toBeDisabled();
    fireEvent.keyDown(handle('Alpha'), { key: 'ArrowDown' });
    fireEvent.keyDown(handle('Alpha'), { key: 'ArrowUp' });
    expect(globalSaveButton()).toBeDisabled();
    fireEvent.click(baseDelete('Beta'));
    fireEvent.keyDown(handle('Alpha'), { key: 'ArrowDown' });
    fireEvent.click(within(baseRow('Beta')).getByRole('button', { name: 'Восстановить базовое поле Beta' }));
    fireEvent.click(globalSaveButton());
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    expect(api.putTemplateContent.mock.calls[0][1].baseFields.map((field: BaseFieldInput) => field.id)).toEqual(['base-b', 'base-c', 'base-a']);
  });

  it('serializes global actions and local edits while the first PUT is pending', async () => {
    let resolveBase!: (value: TemplateContentEnvelope) => void;
    api.putTemplateContent.mockReturnValueOnce(new Promise(resolve => { resolveBase = resolve; }));
    renderTemplates();
    await screen.findByLabelText('Название базового поля Alpha');
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Alpha pending' } });
    fireEvent.change(virtualTitle('Virtual'), { target: { value: 'Virtual pending' } });
    fireEvent.click(globalSaveButton());
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    expect(globalSaveButton()).toBeDisabled();
    expect(globalCancelButton()).toBeDisabled();
    expect(baseTitle('Alpha pending')).toBeDisabled();
    expect(virtualTitle('Virtual pending')).toBeDisabled();
    expect(baseDelete('Beta')).toBeDisabled();
    fireEvent.click(globalSaveButton());
    fireEvent.click(globalCancelButton());
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    expect(screen.queryByRole('textbox', { name: 'Название базового поля Новое поле' })).not.toBeInTheDocument();
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    await act(async () => resolveBase(content(12, [base('base-a', 'a', 'Alpha pending'), base('base-b', 'b', 'Beta')])));
    await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1));
    expect(api.putTemplateVirtualFields.mock.calls[0][1].expectedRevision).toBe(12);
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
  });

  it('blocks the entire save for any invalid active row and excludes deleted invalid rows', async () => {
    renderTemplates();
    await screen.findByLabelText('Название базового поля Alpha');
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Alpha changed' } });
    fireEvent.change(within(baseRow('Beta')).getByRole('textbox', { name: 'Значение по умолчанию Beta' }), { target: { value: '-' } });
    fireEvent.change(virtualTitle('Virtual'), { target: { value: 'Virtual changed' } });
    fireEvent.change(within(virtualRow('Virtual changed')).getByRole('combobox', { name: 'Формула виртуального поля Virtual changed' }), { target: { value: '' } });
    expect(globalSaveButton()).toBeDisabled();
    fireEvent.click(globalSaveButton());
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    fireEvent.click(baseDelete('Beta'));
    expect(globalSaveButton()).toBeDisabled();
    fireEvent.change(within(virtualRow('Virtual changed')).getByRole('combobox', { name: 'Формула виртуального поля Virtual changed' }), { target: { value: 'formula' } });
    expect(globalSaveButton()).toBeEnabled();
    fireEvent.click(globalSaveButton());
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1));
    expect(api.putTemplateContent.mock.calls[0][1].baseFields.map((field: BaseFieldInput) => field.id)).toEqual(['base-a']);
  });

  it('retains only the unconfirmed virtual draft after a partial save and retries only that group', async () => {
    api.putTemplateVirtualFields.mockRejectedValueOnce(new CampaignApiError(400, { code: 'bad', title: 'Bad', detail: 'Bad' }));
    renderTemplates();
    await screen.findByLabelText('Название базового поля Alpha');
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Confirmed base' } });
    fireEvent.change(virtualTitle('Virtual'), { target: { value: 'Draft virtual' } });
    fireEvent.click(virtualDelete('Draft virtual'));
    fireEvent.click(globalSaveButton());
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Базовые поля сохранены. Изменения виртуальных полей не сохранены.')).toBeInTheDocument();
    expect(screen.queryByText('Изменения шаблона сохранены.')).not.toBeInTheDocument();
    expect(baseTitle('Confirmed base')).toHaveValue('Confirmed base');
    expect(within(virtualRow('Draft virtual')).getByRole('textbox', { name: 'Название виртуального поля Draft virtual' })).toBeDisabled();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(globalCancelButton());
    expect(baseTitle('Confirmed base')).toHaveValue('Confirmed base');
    expect(virtualTitle('Virtual')).toHaveValue('Virtual');
    confirm.mockRestore();
    fireEvent.change(virtualTitle('Virtual'), { target: { value: 'Retry virtual' } });
    fireEvent.click(globalSaveButton());
    await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(2));
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    expect(api.putTemplateVirtualFields.mock.calls[1][1].expectedRevision).toBe(12);
  });

  it('applies description, options, and multichoice values locally until global save', async () => {
    serverContent = content(2, [{ ...base('choice', 'choice', 'Choice'), valueType: 'MultiChoice', value: [], options: [{ optionKey: '', title: 'Empty' }, { optionKey: 'opaque', title: 'Opaque' }] }], []);
    renderTemplates();
    await screen.findByLabelText('Название базового поля Choice');
    fireEvent.click(within(baseRow('Choice')).getByRole('button', { name: 'Описание базового поля Choice' }));
    const descriptionDialog = screen.getByRole('dialog', { name: 'Описание поля Choice' });
    expect(globalSaveButton()).toBeDisabled();
    const description = 'first line\n\nsecond line ';
    fireEvent.change(within(descriptionDialog).getByRole('textbox', { name: 'Описание поля' }), { target: { value: description } });
    fireEvent.click(within(descriptionDialog).getByRole('button', { name: 'Применить' }));
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    fireEvent.click(within(baseRow('Choice')).getByRole('button', { name: 'Варианты' }));
    const optionsDialog = screen.getByRole('dialog', { name: 'Варианты поля Choice' });
    fireEvent.change(within(optionsDialog).getByRole('textbox', { name: 'Название варианта 1' }), { target: { value: 'Empty key' } });
    fireEvent.click(within(optionsDialog).getByRole('button', { name: 'Применить' }));
    fireEvent.click(within(baseRow('Choice')).getByRole('button', { name: /Выбрано:/ }));
    const choiceDialog = screen.getByRole('dialog', { name: 'Значения поля Choice' });
    fireEvent.click(within(choiceDialog).getByRole('checkbox', { name: 'Empty key' }));
    fireEvent.click(within(choiceDialog).getByRole('checkbox', { name: 'Opaque' }));
    fireEvent.click(within(choiceDialog).getByRole('button', { name: 'Применить' }));
    expect(globalSaveButton()).toBeEnabled();
    fireEvent.click(globalSaveButton());
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    const payload = api.putTemplateContent.mock.calls[0][1].baseFields[0];
    expect(payload.description).toBe(description);
    expect(payload.options).toEqual([{ optionKey: '', title: 'Empty key' }, { optionKey: 'opaque', title: 'Opaque' }]);
    expect(payload.value).toEqual(['', 'opaque']);
  });

  it('only offers saved nondeleted sources and preserves formula bindings in global payloads', async () => {
    serverContent = content(3, [base('base-a', 'a', 'Alpha'), base('base-b', 'b', 'Beta')], [virtual('virtual-a', 'v', 'Virtual')]);
    api.getFormulaContent.mockResolvedValueOnce({ data: { expression: 'value + parent', parameters: ['value', 'parent'] } });
    renderTemplates();
    await screen.findByLabelText('Название виртуального поля Virtual');
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    const newBase = baseRow('Новое поле');
    const newBaseKey = within(newBase).getByRole('textbox', { name: 'Ключ базового поля Новое поле' });
    const newBaseTitle = within(newBase).getByRole('textbox', { name: 'Название базового поля Новое поле' });
    fireEvent.change(newBaseKey, { target: { value: 'draft' } });
    fireEvent.change(newBaseTitle, { target: { value: 'Unsaved source' } });
    fireEvent.click(baseDelete('Beta'));
    fireEvent.click(within(virtualRow('Virtual')).getByRole('button', { name: 'Настроить' }));
    const dialog = screen.getByRole('dialog', { name: 'Связи поля Virtual' });
    const value = await within(dialog).findByRole('combobox', { name: 'Параметр value' });
    expect(within(value).getByRole('option', { name: 'Alpha' })).toBeInTheDocument();
    expect(within(value).queryByRole('option', { name: 'Beta' })).not.toBeInTheDocument();
    expect(within(value).queryByRole('option', { name: 'Unsaved source' })).not.toBeInTheDocument();
    fireEvent.change(value, { target: { value: 'Base:base-a' } });
    const parent = await within(dialog).findByRole('combobox', { name: 'Параметр parent' });
    fireEvent.change(parent, { target: { value: 'Base:base-a' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Применить' }));
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    fireEvent.click(globalSaveButton());
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1));
    expect(api.putTemplateContent.mock.calls[0][1].baseFields).toHaveLength(2);
    expect(api.putTemplateVirtualFields.mock.calls[0][1].virtualFields[0]).toMatchObject({ formulaId: 'formula', bindings: { value: { kind: 'Base', fieldId: 'base-a' }, parent: { kind: 'Base', fieldId: 'base-a' } } });
    for (const field of api.putTemplateVirtualFields.mock.calls[0][1].virtualFields) {
      expect(field).not.toHaveProperty('parentBaseFieldId');
      expect(field).not.toHaveProperty('parentVirtualFieldId');
    }
  });

  it('recovers unknown publication only after explicit read and preserves pending row identity', async () => {
    serverContent = content(6, [base('base-a', 'a', 'Alpha')], []);
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(503, { code: 'content_write_outcome_unknown', title: 'Unknown', detail: 'Unknown' }, true));
    renderTemplates();
    await screen.findByLabelText('Название базового поля Alpha');
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    const row = baseRow('Новое поле');
    const newBaseKey = within(row).getByRole('textbox', { name: 'Ключ базового поля Новое поле' });
    const newBaseTitle = within(row).getByRole('textbox', { name: 'Название базового поля Новое поле' });
    fireEvent.change(newBaseKey, { target: { value: 'new-key' } });
    fireEvent.change(newBaseTitle, { target: { value: 'Local title' } });
    fireEvent.click(globalSaveButton());
    await screen.findByText('Результат операции неизвестен. Проверьте данные перед повторной попыткой.');
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    expect(api.getTemplateContent).toHaveBeenCalledTimes(1);
    api.getTemplateContent.mockResolvedValueOnce(content(7, [base('base-a', 'a', 'Alpha'), base('published-id', 'new-key', 'Server title')], []));
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать содержимое' }));
    await screen.findByLabelText('Название базового поля Local title');
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
  });

  it('freezes both groups after conflict and retries the full draft only after explicit read', async () => {
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'content_revision_conflict', title: 'Conflict', detail: 'Conflict' }));
    api.getTemplateContent.mockResolvedValueOnce(content()).mockResolvedValueOnce(content(14, [base('base-a', 'a', 'Alpha fresh'), base('base-b', 'b', 'Beta')], [virtual('virtual-a', 'v', 'Virtual')], 'fresh\npassive'));
    renderTemplates();
    await screen.findByLabelText('Название базового поля Alpha');
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Alpha draft' } });
    fireEvent.change(baseTitle('Beta'), { target: { value: 'Beta draft' } });
    fireEvent.change(virtualTitle('Virtual'), { target: { value: 'Virtual draft' } });
    fireEvent.click(globalSaveButton());
    await screen.findByText('Конфликт версии. Черновик сохранён; перечитайте данные перед повторным сохранением.');
    expect(globalSaveButton()).toBeDisabled();
    expect(globalCancelButton()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Перечитать содержимое' })).toBeEnabled();
    expect(api.getTemplateContent).toHaveBeenCalledTimes(1);
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать содержимое' }));
    await waitFor(() => expect(globalSaveButton()).toBeEnabled());
    expect(baseTitle('Beta draft')).toHaveValue('Beta draft');
    fireEvent.click(globalSaveButton());
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1));
    expect(api.putTemplateContent.mock.calls[1][1]).toMatchObject({ expectedRevision: 14, description: 'fresh\npassive' });
    expect(api.putTemplateContent.mock.calls[1][1].baseFields).toEqual([
      expect.objectContaining({ id: 'base-a', title: 'Alpha draft' }),
      expect.objectContaining({ id: 'base-b', title: 'Beta draft' }),
    ]);
    expect(api.putTemplateVirtualFields.mock.calls[0][1].virtualFields).toEqual([expect.objectContaining({ id: 'virtual-a', title: 'Virtual draft' })]);
  });

  it('keeps server-missing dirty rows and blocks save until global cancel', async () => {
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'conflict', title: 'Conflict', detail: 'Conflict' }));
    api.getTemplateContent.mockResolvedValueOnce(content()).mockResolvedValueOnce(content(12, [base('base-b', 'b', 'Beta')], [virtual('virtual-a', 'v', 'Virtual')]));
    renderTemplates();
    await screen.findByLabelText('Название базового поля Alpha');
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Local Alpha' } });
    fireEvent.click(globalSaveButton());
    await screen.findByText('Конфликт версии. Черновик сохранён; перечитайте данные перед повторным сохранением.');
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать содержимое' }));
    await screen.findByText('Поле удалено на сервере. Отмените черновик.');
    expect(globalSaveButton()).toBeDisabled();
    expect(baseDelete('Local Alpha')).toBeDisabled();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(globalCancelButton());
    expect(screen.queryByRole('textbox', { name: 'Название базового поля Local Alpha' })).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('preserves lossless int64 values and passive description in global payloads', async () => {
    const exact = new LosslessNumber('9223372036854775807');
    serverContent = content(2, [{ ...base('integer', 'integer', 'Integer', exact), valueType: 'Integer' }], []);
    renderTemplates();
    await screen.findByLabelText('Название базового поля Integer');
    expect(within(baseRow('Integer')).getByRole('textbox', { name: 'Значение по умолчанию Integer' })).toHaveValue('9223372036854775807');
    fireEvent.change(baseTitle('Integer'), { target: { value: 'Updated integer' } });
    fireEvent.click(globalSaveButton());
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    expect(api.putTemplateContent.mock.calls[0][1].description).toBe('passive\ndescription');
    expect(isLosslessNumber(api.putTemplateContent.mock.calls[0][1].baseFields[0].value)).toBe(true);
    expect(String(api.putTemplateContent.mock.calls[0][1].baseFields[0].value)).toBe('9223372036854775807');
  });

  it('disables global actions while an active modal is open', async () => {
    renderTemplates();
    await screen.findByLabelText('Название базового поля Alpha');
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Alpha draft' } });
    fireEvent.click(within(baseRow('Alpha draft')).getByRole('button', { name: 'Описание базового поля Alpha draft' }));
    expect(globalSaveButton()).toBeDisabled();
    expect(globalCancelButton()).toBeDisabled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отмена' }));
    expect(globalSaveButton()).toBeEnabled();
    expect(globalCancelButton()).toBeEnabled();
    expect(api.putTemplateContent).not.toHaveBeenCalled();
  });

  it('retains drafts while permissions are unavailable and allows local cancel', async () => {
    const view = renderTemplates();
    await screen.findByLabelText('Название базового поля Alpha');
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Draft during refresh' } });
    shared.canWrite = false;
    shared.permissionsLoading = true;
    view.rerender(tree());
    expect(baseTitle('Draft during refresh')).toBeDisabled();
    expect(globalSaveButton()).toBeDisabled();
    expect(globalCancelButton()).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    expect(screen.queryByRole('textbox', { name: 'Название базового поля Новое поле' })).not.toBeInTheDocument();
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(globalCancelButton());
    expect(baseTitle('Alpha')).toHaveValue('Alpha');
    confirm.mockRestore();
  });

  it('ignores late content from a prior campaign and does not call template metadata endpoints', async () => {
    let resolveOld!: (value: TemplateContentEnvelope) => void;
    api.getTemplateContent.mockImplementation((id: number) => id === 4 ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ ...content(), campaignId: 5, data: { ...content().data, baseFields: [base('five', 'five', 'Campaign 5')] } }));
    renderTemplates();
    fireEvent.click(screen.getByRole('button', { name: 'Другую кампанию' }));
    expect(await screen.findByLabelText('Название базового поля Campaign 5')).toHaveValue('Campaign 5');
    await act(async () => resolveOld(content()));
    expect(screen.queryByRole('textbox', { name: 'Название базового поля Alpha' })).not.toBeInTheDocument();
    expect(api.getTemplateContent).toHaveBeenCalledWith(5);
    expect(api.getTemplate).not.toHaveBeenCalled();
    expect(api.renameTemplate).not.toHaveBeenCalled();
  });
});
