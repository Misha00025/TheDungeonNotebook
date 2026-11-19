import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { isLosslessNumber, LosslessNumber } from 'lossless-json';
import iconButtonStyles from '@tdn/shared/ui/Buttons/IconButton/IconButton.module.css';
import Templates from './Templates';
import { CampaignApiError } from './api';
import type { BaseField, BaseFieldInput, TemplateContentEnvelope, VirtualField, VirtualFieldInput } from './types';

const shared = vi.hoisted(() => ({ dirty: false, canWrite: true, permissionsLoading: false, invalidation: 0, sessionKey: 'user' }));
const api = vi.hoisted(() => ({ listFormulas: vi.fn(), getFormulaContent: vi.fn(), getTemplate: vi.fn(), getTemplateContent: vi.fn(), renameTemplate: vi.fn(), putTemplateContent: vi.fn(), putTemplateVirtualFields: vi.fn() }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, sessionKey: shared.sessionKey, invalidation: shared.invalidation, notifyInvalidation: vi.fn() }), useDirtyDraft: (_owner: string, dirty: boolean) => { shared.dirty = dirty; return () => { shared.dirty = false; }; } }));
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
const saveBaseButton = (label: string) => within(baseRow(label)).getByRole('button', { name: `Сохранить базовое поле ${label}` });

describe('singleton campaign template editor', () => {
  beforeEach(() => {
    shared.dirty = false;
    shared.canWrite = true;
    shared.permissionsLoading = false;
    shared.invalidation = 0;
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

  it('shows both native tables and every saved row without a virtual-fields gate', async () => {
    renderTemplates();
    expect(await screen.findByRole('heading', { name: 'Базовые поля' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Виртуальные поля' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Базовые поля' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Виртуальные поля' })).toBeInTheDocument();
    const base = baseRow('Alpha');
    const virtualFieldRow = virtualRow('Virtual');
    expect(base.tagName).toBe('TR');
    expect(virtualFieldRow.tagName).toBe('TR');
    expect(base.className).not.toMatch(/card|fieldset/i);
    expect(screen.getAllByRole('row', { name: /^Базовое поле / })).toHaveLength(2);
    expect(screen.getAllByRole('row', { name: /^Виртуальное поле / })).toHaveLength(1);
    expect(base.parentElement?.tagName).toBe('TBODY');
    expect(virtualFieldRow.parentElement?.tagName).toBe('TBODY');
    const savedBaseType = within(base).getByRole('combobox', { name: 'Тип базового поля Alpha' });
    const savedVirtualType = within(virtualFieldRow).getByRole('combobox', { name: 'Тип виртуального поля Virtual' });
    expect(savedBaseType).toHaveValue('Number');
    expect(within(savedBaseType).getByRole('option', { name: 'Дробное число' })).toHaveValue('Number');
    expect(savedVirtualType).toHaveValue('Number');
    expect(within(savedVirtualType).getByRole('option', { name: 'Дробное число' })).toHaveValue('Number');
    expect(within(base).getByRole('textbox', { name: 'Ключ базового поля Alpha' })).toBeDisabled();
    expect(within(base).getByRole('button', { name: 'Описание базового поля Alpha' })).toBeInTheDocument();
    expect(within(base).queryByRole('button', { name: 'Сохранить базовое поле Alpha' })).not.toBeInTheDocument();
    expect(within(base).queryByRole('button', { name: 'Отменить изменения базового поля Alpha' })).not.toBeInTheDocument();
    expect(within(base).getByRole('button', { name: 'Удалить базовое поле Alpha' })).toHaveClass(iconButtonStyles.danger);
    expect(within(virtualFieldRow).queryByRole('button', { name: 'Сохранить виртуальное поле Virtual' })).not.toBeInTheDocument();
    expect(within(virtualFieldRow).queryByRole('button', { name: 'Отменить изменения виртуального поля Virtual' })).not.toBeInTheDocument();
    expect(within(virtualFieldRow).getByRole('button', { name: 'Удалить виртуальное поле Virtual' })).toHaveClass(iconButtonStyles.danger);
    expect(screen.queryByRole('button', { name: 'Сохранить базовые поля' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сохранить виртуальные поля' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Открыть виртуальные поля' })).not.toBeInTheDocument();
    expect(api.getTemplateContent).toHaveBeenCalledWith(4);
    await waitFor(() => expect(api.listFormulas).toHaveBeenCalledWith(4));
    expect(api.getTemplate).not.toHaveBeenCalled();
    expect(api.renameTemplate).not.toHaveBeenCalled();
    expect(api).not.toHaveProperty('listTemplates');
    expect(api).not.toHaveProperty('createTemplate');
  });

  it('renders the agreed new base default and uses row-local actions with compact action layout', async () => {
    renderTemplates();
    await screen.findByRole('row', { name: 'Базовое поле Alpha' });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    const row = baseRow('Новое поле');
    expect(within(row).getByRole('textbox', { name: 'Значение по умолчанию Новое поле' })).toHaveValue('0');
    const baseType = within(row).getByRole('combobox', { name: 'Тип базового поля Новое поле' });
    expect(baseType).toHaveValue('Integer');
    expect(within(baseType).getByRole('option', { name: 'Целое число' })).toHaveValue('Integer');
    const save = within(row).getByRole('button', { name: 'Сохранить базовое поле Новое поле' });
    expect(save).toBeDisabled();
    const actionRow = save.closest('[style*="flex-wrap"]');
    expect((actionRow as HTMLElement).style.flexWrap).toBe('nowrap');
    expect((actionRow as HTMLElement).style.getPropertyValue('gap')).toBe('.375rem');
    fireEvent.click(screen.getByRole('button', { name: 'Добавить виртуальное поле' }));
    const virtualNew = virtualRow('Новое поле');
    const virtualType = within(virtualNew).getByRole('combobox', { name: 'Тип виртуального поля Новое поле' });
    expect(virtualType).toHaveValue('Integer');
    expect(within(virtualType).getByRole('option', { name: 'Целое число' })).toHaveValue('Integer');
  });

  it('shows row save and cancel actions only while each base or virtual row is dirty', async () => {
    renderTemplates();
    await screen.findByRole('row', { name: 'Базовое поле Alpha' });
    const alphaRow = baseRow('Alpha');
    const betaRow = baseRow('Beta');
    const virtualFieldRow = virtualRow('Virtual');
    const alphaName = within(alphaRow).getByRole('textbox', { name: 'Название базового поля Alpha' });
    const betaName = within(betaRow).getByRole('textbox', { name: 'Название базового поля Beta' });
    const betaValue = within(betaRow).getByRole('textbox', { name: 'Значение по умолчанию Beta' });
    const virtualName = within(virtualFieldRow).getByRole('textbox', { name: 'Название виртуального поля Virtual' });

    expect(within(alphaRow).queryByRole('button', { name: 'Сохранить базовое поле Alpha' })).not.toBeInTheDocument();
    expect(within(alphaRow).queryByRole('button', { name: 'Отменить изменения базового поля Alpha' })).not.toBeInTheDocument();
    expect(within(virtualFieldRow).queryByRole('button', { name: 'Сохранить виртуальное поле Virtual' })).not.toBeInTheDocument();
    expect(within(virtualFieldRow).queryByRole('button', { name: 'Отменить изменения виртуального поля Virtual' })).not.toBeInTheDocument();

    fireEvent.change(alphaName, { target: { value: 'Alpha draft' } });
    expect(within(alphaRow).getByRole('button', { name: 'Сохранить базовое поле Alpha draft' })).toBeEnabled();
    expect(within(alphaRow).getByRole('button', { name: 'Отменить изменения базового поля Alpha draft' })).toBeEnabled();
    fireEvent.click(within(alphaRow).getByRole('button', { name: 'Отменить изменения базового поля Alpha draft' }));
    expect(alphaName).toHaveValue('Alpha');
    expect(within(alphaRow).queryByRole('button', { name: 'Сохранить базовое поле Alpha' })).not.toBeInTheDocument();
    expect(within(alphaRow).queryByRole('button', { name: 'Отменить изменения базового поля Alpha' })).not.toBeInTheDocument();

    fireEvent.change(alphaName, { target: { value: 'Alpha saved' } });
    fireEvent.change(betaName, { target: { value: 'Beta draft' } });
    fireEvent.change(virtualName, { target: { value: 'Virtual draft' } });
    expect(within(virtualFieldRow).getByRole('button', { name: 'Сохранить виртуальное поле Virtual draft' })).toBeEnabled();
    expect(within(virtualFieldRow).getByRole('button', { name: 'Отменить изменения виртуального поля Virtual draft' })).toBeEnabled();
    fireEvent.click(within(alphaRow).getByRole('button', { name: 'Сохранить базовое поле Alpha saved' }));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    await act(async () => { await api.putTemplateContent.mock.results[0].value; });
    await waitFor(() => {
      expect(within(alphaRow).queryByRole('button', { name: 'Сохранить базовое поле Alpha saved' })).not.toBeInTheDocument();
      expect(within(alphaRow).queryByRole('button', { name: 'Отменить изменения базового поля Alpha saved' })).not.toBeInTheDocument();
    });
    expect(alphaName).toHaveValue('Alpha saved');
    expect(betaName).toHaveValue('Beta draft');
    expect(within(betaRow).getByRole('button', { name: 'Сохранить базовое поле Beta draft' })).toBeEnabled();
    expect(within(betaRow).getByRole('button', { name: 'Отменить изменения базового поля Beta draft' })).toBeEnabled();

    fireEvent.change(betaName, { target: { value: 'Beta' } });
    expect(within(betaRow).queryByRole('button', { name: 'Сохранить базовое поле Beta' })).not.toBeInTheDocument();
    expect(within(betaRow).queryByRole('button', { name: 'Отменить изменения базового поля Beta' })).not.toBeInTheDocument();
    fireEvent.click(within(virtualFieldRow).getByRole('button', { name: 'Отменить изменения виртуального поля Virtual draft' }));
    expect(virtualName).toHaveValue('Virtual');
    expect(within(virtualFieldRow).queryByRole('button', { name: 'Сохранить виртуальное поле Virtual' })).not.toBeInTheDocument();
    expect(within(virtualFieldRow).queryByRole('button', { name: 'Отменить изменения виртуального поля Virtual' })).not.toBeInTheDocument();

    fireEvent.change(betaValue, { target: { value: '-' } });
    expect(within(betaRow).getByRole('button', { name: 'Сохранить базовое поле Beta' })).toBeDisabled();
    expect(within(betaRow).getByRole('button', { name: 'Отменить изменения базового поля Beta' })).toBeEnabled();
    fireEvent.click(within(betaRow).getByRole('button', { name: 'Отменить изменения базового поля Beta' }));
    expect(within(betaRow).getByRole('textbox', { name: 'Значение по умолчанию Beta' })).toHaveValue('0');
    expect(within(betaRow).queryByRole('button', { name: 'Сохранить базовое поле Beta' })).not.toBeInTheDocument();
    expect(within(betaRow).queryByRole('button', { name: 'Отменить изменения базового поля Beta' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    const newBaseRow = baseRow('Новое поле');
    expect(within(newBaseRow).getByRole('button', { name: 'Сохранить базовое поле Новое поле' })).toBeDisabled();
    expect(within(newBaseRow).getByRole('button', { name: 'Отменить изменения базового поля Новое поле' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Добавить виртуальное поле' }));
    const newVirtualRow = virtualRow('Новое поле');
    expect(within(newVirtualRow).getByRole('button', { name: 'Сохранить виртуальное поле Новое поле' })).toBeDisabled();
    expect(within(newVirtualRow).getByRole('button', { name: 'Отменить изменения виртуального поля Новое поле' })).toBeEnabled();
  });

  it('saves only one base row from the saved baseline and retains a neighboring invalid raw draft', async () => {
    renderTemplates();
    await screen.findByRole('row', { name: 'Базовое поле Alpha' });
    const alphaRow = baseRow('Alpha');
    const betaRow = baseRow('Beta');
    const alphaName = within(alphaRow).getByRole('textbox', { name: 'Название базового поля Alpha' });
    const betaName = within(betaRow).getByRole('textbox', { name: 'Название базового поля Beta' });
    const betaValue = within(betaRow).getByRole('textbox', { name: 'Значение по умолчанию Beta' });
    fireEvent.change(alphaName, { target: { value: 'Alpha updated' } });
    fireEvent.change(betaName, { target: { value: 'Beta draft' } });
    fireEvent.change(betaValue, { target: { value: '-' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    const fresh = baseRow('Новое поле');
    const freshKey = within(fresh).getByRole('textbox', { name: 'Ключ базового поля Новое поле' });
    const freshName = within(fresh).getByRole('textbox', { name: 'Название базового поля Новое поле' });
    fireEvent.change(freshKey, { target: { value: 'c' } });
    fireEvent.change(freshName, { target: { value: 'Gamma' } });
    expect(within(alphaRow).getByRole('button', { name: 'Сохранить базовое поле Alpha updated' })).toBeEnabled();
    expect(within(betaRow).getByRole('button', { name: 'Сохранить базовое поле Beta draft' })).toBeDisabled();
    fireEvent.click(within(alphaRow).getByRole('button', { name: 'Сохранить базовое поле Alpha updated' }));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    const payload = api.putTemplateContent.mock.calls[0][1];
    expect(payload).toMatchObject({ expectedRevision: 11, description: 'passive\ndescription' });
    expect(payload.baseFields).toEqual([
      expect.objectContaining({ id: 'base-a', key: 'a', title: 'Alpha updated' }),
      expect.objectContaining({ id: 'base-b', key: 'b', title: 'Beta' }),
    ]);
    expect(payload.baseFields).toHaveLength(2);
    expect(payload.baseFields[0]).not.toHaveProperty('typeRevision');
    expect(within(betaRow).getByRole('textbox', { name: 'Значение по умолчанию Beta draft' })).toHaveValue('-');
    expect(screen.getByRole('row', { name: 'Базовое поле Gamma' })).toBeInTheDocument();
    expect(saveBaseButton('Gamma')).toBeEnabled();
  });

  it('cancels only the selected row and deletes only the confirmed target; deleting a new row is local', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTemplates();
    await screen.findByRole('row', { name: 'Базовое поле Alpha' });
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Alpha draft' } });
    fireEvent.change(baseTitle('Beta'), { target: { value: 'Beta draft' } });
    fireEvent.click(within(baseRow('Alpha draft')).getByRole('button', { name: 'Отменить изменения базового поля Alpha draft' }));
    expect(baseTitle('Alpha')).toHaveValue('Alpha');
    expect(baseTitle('Beta draft')).toHaveValue('Beta draft');
    fireEvent.click(within(baseRow('Alpha')).getByRole('button', { name: 'Удалить базовое поле Alpha' }));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('row', { name: 'Базовое поле Alpha' })).not.toBeInTheDocument());
    expect(confirm).toHaveBeenCalledWith('Удалить поле «Alpha»?');
    expect(api.putTemplateContent.mock.calls[0][1].baseFields).toEqual([expect.objectContaining({ id: 'base-b', title: 'Beta' })]);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    const fresh = baseRow('Новое поле');
    const freshKey = within(fresh).getByRole('textbox', { name: 'Ключ базового поля Новое поле' });
    const freshName = within(fresh).getByRole('textbox', { name: 'Название базового поля Новое поле' });
    fireEvent.change(freshKey, { target: { value: 'local' } });
    fireEvent.change(freshName, { target: { value: 'Local' } });
    fireEvent.click(within(fresh).getByRole('button', { name: 'Удалить базовое поле Local' }));
    expect(screen.queryByRole('row', { name: 'Базовое поле Local' })).not.toBeInTheDocument();
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it('applies description and options to the draft only, then writes them with the row save', async () => {
    const descriptionView = renderTemplates();
    await screen.findByRole('row', { name: 'Базовое поле Alpha' });
    fireEvent.click(within(baseRow('Alpha')).getByRole('button', { name: 'Описание базового поля Alpha' }));
    const descriptionDialog = screen.getByRole('dialog', { name: 'Описание поля Alpha' });
    const description = 'first line\n\nsecond line ';
    fireEvent.change(within(descriptionDialog).getByRole('textbox', { name: 'Описание поля' }), { target: { value: description } });
    fireEvent.click(within(descriptionDialog).getByRole('button', { name: 'Применить' }));
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    fireEvent.click(saveBaseButton('Alpha'));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    await act(async () => { await api.putTemplateContent.mock.results[0].value; });
    expect(api.putTemplateContent.mock.calls[0][1].baseFields[0].description).toBe(description);
    descriptionView.unmount();

    serverContent = content(12, [{ ...base('choice', 'choice', 'Choice'), valueType: 'MultiChoice', value: [], options: [{ optionKey: '', title: 'Empty' }] }], []);
    const view = renderTemplates();
    await screen.findByRole('row', { name: 'Базовое поле Choice' });
    fireEvent.click(within(baseRow('Choice')).getByRole('button', { name: 'Варианты' }));
    const optionsDialog = screen.getByRole('dialog', { name: 'Варианты поля Choice' });
    fireEvent.change(within(optionsDialog).getByRole('textbox', { name: 'Название варианта 1' }), { target: { value: 'Empty key' } });
    fireEvent.click(within(optionsDialog).getByRole('button', { name: 'Применить' }));
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    fireEvent.click(saveBaseButton('Choice'));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(2));
    expect(api.putTemplateContent.mock.calls[1][1].baseFields[0].options).toEqual([{ optionKey: '', title: 'Empty key' }]);
    view.unmount();
  });

  it('shows multichoice values in a compact summary and applies them through a dialog', async () => {
    serverContent = content(3, [{ ...base('multi', 'multi', 'Multi'), valueType: 'MultiChoice', value: [], options: [{ optionKey: '', title: 'Empty' }, { optionKey: 'opaque', title: 'Opaque' }] }], []);
    renderTemplates();
    await screen.findByRole('row', { name: 'Базовое поле Multi' });
    const row = baseRow('Multi');
    expect(within(row).getByRole('button', { name: 'Выбрано: 0' })).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: 'Выбрано: 0' }));
    const dialog = screen.getByRole('dialog', { name: 'Значения поля Multi' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Empty' }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Opaque' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Применить' }));
    expect(within(baseRow('Multi')).getByRole('button', { name: 'Выбрано: 2' })).toBeInTheDocument();
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    fireEvent.click(saveBaseButton('Multi'));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    expect(api.putTemplateContent.mock.calls[0][1].baseFields[0].value).toEqual(['', 'opaque']);
  });

  it('serializes row writes and advances the common base/virtual revision from zero', async () => {
    serverContent = content(0, [], []);
    api.listFormulas.mockResolvedValue([{ id: 'formula', key: 'f', campaignId: 4, name: 'Formula', metadataRevision: 1 }]);
    renderTemplates();
    await screen.findByRole('heading', { name: 'Виртуальные поля' });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    const baseNew = baseRow('Новое поле');
    const baseKey = within(baseNew).getByRole('textbox', { name: 'Ключ базового поля Новое поле' });
    const baseName = within(baseNew).getByRole('textbox', { name: 'Название базового поля Новое поле' });
    fireEvent.change(baseKey, { target: { value: 'base' } });
    fireEvent.change(baseName, { target: { value: 'Base' } });
    fireEvent.click(within(baseRow('Base')).getByRole('button', { name: 'Сохранить базовое поле Base' }));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 0 })));
    await waitFor(() => expect(screen.getByRole('row', { name: 'Базовое поле Base' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Добавить виртуальное поле' }));
    const virtualNew = virtualRow('Новое поле');
    const virtualKey = within(virtualNew).getByRole('textbox', { name: 'Ключ виртуального поля Новое поле' });
    const virtualName = within(virtualNew).getByRole('textbox', { name: 'Название виртуального поля Новое поле' });
    const virtualFormula = within(virtualNew).getByRole('combobox', { name: 'Формула виртуального поля Новое поле' });
    fireEvent.change(virtualKey, { target: { value: 'virtual' } });
    fireEvent.change(virtualName, { target: { value: 'Virtual new' } });
    fireEvent.change(virtualFormula, { target: { value: 'formula' } });
    fireEvent.click(within(virtualRow('Virtual new')).getByRole('button', { name: 'Сохранить виртуальное поле Virtual new' }));
    await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 1 })));
  });

  it('keeps writes serialized while a target save is pending and uses its returned revision next', async () => {
    serverContent = content(4, [base('base-a', 'a', 'Alpha')], [virtual('virtual-a', 'v', 'Virtual')]);
    let resolveBaseWrite!: (value: TemplateContentEnvelope) => void;
    api.putTemplateContent.mockReturnValueOnce(new Promise(resolve => { resolveBaseWrite = resolve; }));
    renderTemplates();
    await screen.findByRole('row', { name: 'Базовое поле Alpha' });
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Alpha draft' } });
    fireEvent.change(within(virtualRow('Virtual')).getByRole('textbox', { name: 'Название виртуального поля Virtual' }), { target: { value: 'Virtual draft' } });
    fireEvent.click(saveBaseButton('Alpha draft'));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    expect(saveBaseButton('Alpha draft')).toBeDisabled();
    expect(within(virtualRow('Virtual draft')).getByRole('button', { name: 'Сохранить виртуальное поле Virtual draft' })).toBeDisabled();
    fireEvent.click(within(virtualRow('Virtual draft')).getByRole('button', { name: 'Сохранить виртуальное поле Virtual draft' }));
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    await act(async () => resolveBaseWrite(content(5, [base('base-a', 'a', 'Alpha draft')], [virtual('virtual-a', 'v', 'Virtual')])));
    await waitFor(() => expect(within(virtualRow('Virtual draft')).getByRole('button', { name: 'Сохранить виртуальное поле Virtual draft' })).toBeEnabled());
    fireEvent.click(within(virtualRow('Virtual draft')).getByRole('button', { name: 'Сохранить виртуальное поле Virtual draft' }));
    await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 5 })));
  });

  it('recovers an unknown new-row publication only after explicit read without losing its local row draft', async () => {
    serverContent = content(6, [base('base-a', 'a', 'Alpha')], []);
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(503, { code: 'content_write_outcome_unknown', title: 'Unknown', detail: 'Unknown' }, true));
    renderTemplates();
    await screen.findByRole('row', { name: 'Базовое поле Alpha' });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    const newRow = baseRow('Новое поле');
    const newKey = within(newRow).getByRole('textbox', { name: 'Ключ базового поля Новое поле' });
    const newName = within(newRow).getByRole('textbox', { name: 'Название базового поля Новое поле' });
    fireEvent.change(newKey, { target: { value: 'new-key' } });
    fireEvent.change(newName, { target: { value: 'Local title' } });
    fireEvent.click(saveBaseButton('Local title'));
    await screen.findByText('Результат операции неизвестен. Проверьте данные перед повторной попыткой.');
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    api.getTemplateContent.mockResolvedValueOnce(content(7, [base('base-a', 'a', 'Alpha'), base('published-id', 'new-key', 'Server title')], []));
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать содержимое' }));
    await waitFor(() => expect(api.getTemplateContent).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('row', { name: 'Базовое поле Local title' })).toBeInTheDocument();
    fireEvent.click(saveBaseButton('Local title'));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(2));
    expect(api.putTemplateContent.mock.calls[1][1].baseFields).toHaveLength(2);
    expect(api.putTemplateContent.mock.calls[1][1].baseFields[1]).toMatchObject({ id: 'published-id', key: 'new-key', title: 'Local title' });
  });

  it('renders server-missing dirty rows with an alert and only cancel removes them', async () => {
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'conflict', title: 'Conflict', detail: 'Conflict' }));
    api.getTemplateContent.mockResolvedValueOnce(content()).mockResolvedValueOnce(content(12, [base('base-b', 'b', 'Beta')], [virtual('virtual-a', 'v', 'Virtual')]));
    renderTemplates();
    await screen.findByRole('row', { name: 'Базовое поле Alpha' });
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Local Alpha' } });
    fireEvent.click(saveBaseButton('Local Alpha'));
    await screen.findByText('Конфликт версии. Черновик сохранён; перечитайте данные перед повторным сохранением.');
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать содержимое' }));
    await screen.findByText('Поле удалено на сервере. Отмените черновик.');
    const missingRow = baseRow('Local Alpha');
    expect(within(missingRow).getByText('Поле удалено на сервере. Отмените черновик.')).toBeInTheDocument();
    expect(within(missingRow).getByRole('button', { name: 'Сохранить базовое поле Local Alpha' })).toBeDisabled();
    expect(within(missingRow).getByRole('button', { name: 'Удалить базовое поле Local Alpha' })).toBeDisabled();
    fireEvent.click(within(missingRow).getByRole('button', { name: 'Отменить изменения базового поля Local Alpha' }));
    expect(screen.queryByRole('row', { name: 'Базовое поле Local Alpha' })).not.toBeInTheDocument();
  });

  it('preserves lossless int64 default values through row edits and save payloads', async () => {
    const exact = new LosslessNumber('9223372036854775807');
    serverContent = content(2, [{ ...base('integer', 'integer', 'Integer', exact), valueType: 'Integer' }], []);
    renderTemplates();
    await screen.findByRole('row', { name: 'Базовое поле Integer' });
    expect(within(baseRow('Integer')).getByRole('textbox', { name: 'Значение по умолчанию Integer' })).toHaveValue('9223372036854775807');
    fireEvent.change(baseTitle('Integer'), { target: { value: 'Updated integer' } });
    fireEvent.click(saveBaseButton('Updated integer'));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    expect(isLosslessNumber(api.putTemplateContent.mock.calls[0][1].baseFields[0].value)).toBe(true);
    expect(String(api.putTemplateContent.mock.calls[0][1].baseFields[0].value)).toBe('9223372036854775807');
  });

  it('keeps formula loading independent and restricts virtual-link bindings to saved sources', async () => {
    serverContent = content(3, [base('base-a', 'a', 'Alpha'), base('base-b', 'b', 'Beta')], [virtual('virtual-a', 'v', 'Virtual')]);
    api.listFormulas.mockReturnValueOnce(new Promise(() => {}));
    api.getFormulaContent.mockResolvedValueOnce({ data: { expression: 'value + parent', parameters: ['value', 'parent'] } });
    renderTemplates();
    await screen.findByRole('row', { name: 'Виртуальное поле Virtual' });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    const draftSource = baseRow('Новое поле');
    const draftSourceKey = within(draftSource).getByRole('textbox', { name: 'Ключ базового поля Новое поле' });
    const draftSourceName = within(draftSource).getByRole('textbox', { name: 'Название базового поля Новое поле' });
    fireEvent.change(draftSourceKey, { target: { value: 'draft' } });
    fireEvent.change(draftSourceName, { target: { value: 'Unsaved source' } });
    fireEvent.click(within(virtualRow('Virtual')).getByRole('button', { name: 'Настроить' }));
    const dialog = screen.getByRole('dialog', { name: 'Связи поля Virtual' });
    const value = await within(dialog).findByRole('combobox', { name: 'Параметр value' });
    expect(within(value).getByRole('option', { name: 'Alpha' })).toBeInTheDocument();
    expect(within(value).getByRole('option', { name: 'Virtual' })).toBeInTheDocument();
    expect(within(value).queryByRole('option', { name: 'Unsaved source' })).not.toBeInTheDocument();
    fireEvent.change(value, { target: { value: 'Base:base-a' } });
    const parent = await within(dialog).findByRole('combobox', { name: 'Параметр parent' });
    expect(within(parent).getByRole('option', { name: 'Beta' })).toHaveValue('Base:base-b');
    fireEvent.change(parent, { target: { value: 'Base:base-b' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Применить' }));
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    fireEvent.click(within(virtualRow('Virtual')).getByRole('button', { name: 'Сохранить виртуальное поле Virtual' }));
    await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1));
    expect(api.putTemplateVirtualFields.mock.calls[0][1].virtualFields).toHaveLength(1);
    expect(api.putTemplateVirtualFields.mock.calls[0][1].virtualFields[0]).toMatchObject({ formulaId: 'formula', bindings: { value: { kind: 'Base', fieldId: 'base-a' }, parent: { kind: 'Base', fieldId: 'base-b' } } });
    for (const field of api.putTemplateVirtualFields.mock.calls[0][1].virtualFields) {
      expect(field).not.toHaveProperty('parentBaseFieldId');
      expect(field).not.toHaveProperty('parentVirtualFieldId');
    }
  });

  it('retries formula metadata failures without hiding virtual-field rows', async () => {
    api.listFormulas.mockRejectedValueOnce(new Error('formula list unavailable'));
    renderTemplates();
    expect(await screen.findByRole('row', { name: 'Виртуальное поле Virtual' })).toBeInTheDocument();
    expect(await screen.findByText('Не удалось выполнить операцию. Попробуйте ещё раз.')).toBeInTheDocument();
    api.listFormulas.mockResolvedValueOnce([{ id: 'formula', key: 'f', campaignId: 4, name: 'Formula', metadataRevision: 1 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
    await waitFor(() => expect(api.listFormulas).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(virtualRow('Virtual')).getByRole('combobox', { name: 'Формула виртуального поля Virtual' })).toHaveValue('formula'));
  });

  it('keeps an unavailable formula id selected behind a human-readable option', async () => {
    serverContent = content(3, [], [virtual('virtual-a', 'v', 'Virtual')]);
    serverContent.data.virtualFields[0].formulaId = 'opaque:unknown';
    api.listFormulas.mockResolvedValueOnce([]);
    renderTemplates();
    const formulaSelect = await screen.findByRole('combobox', { name: 'Формула виртуального поля Virtual' });
    await waitFor(() => expect(formulaSelect).toHaveValue('opaque:unknown'));
    expect(within(virtualRow('Virtual')).getByRole('option', { name: 'Недоступная формула' })).toHaveValue('opaque:unknown');
  });

  it('freezes writes after conflict, preserves all drafts, and retries only after explicit read with fresh revision', async () => {
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'content_revision_conflict', title: 'Conflict', detail: 'Conflict' }));
    api.getTemplateContent.mockResolvedValueOnce(content()).mockResolvedValueOnce(content(14, [base('base-a', 'a', 'Alpha fresh'), base('base-b', 'b', 'Beta')], [virtual('virtual-a', 'v', 'Virtual')], 'fresh\npassive'));
    renderTemplates();
    await screen.findByRole('row', { name: 'Базовое поле Alpha' });
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Alpha draft' } });
    fireEvent.change(baseTitle('Beta'), { target: { value: 'Beta draft' } });
    fireEvent.click(saveBaseButton('Alpha draft'));
    await screen.findByText('Конфликт версии. Черновик сохранён; перечитайте данные перед повторным сохранением.');
    expect(saveBaseButton('Alpha draft')).toBeDisabled();
    expect(within(baseRow('Alpha draft')).getByRole('button', { name: 'Отменить изменения базового поля Alpha draft' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Перечитать содержимое' })).toBeEnabled();
    expect(api.getTemplateContent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать содержимое' }));
    await waitFor(() => expect(api.getTemplateContent).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('row', { name: 'Базовое поле Alpha draft' })).toBeInTheDocument();
    expect(baseTitle('Beta draft')).toHaveValue('Beta draft');
    await waitFor(() => expect(saveBaseButton('Alpha draft')).toBeEnabled());
    fireEvent.click(saveBaseButton('Alpha draft'));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(2));
    expect(api.putTemplateContent.mock.calls[1][1]).toMatchObject({ expectedRevision: 14, description: 'fresh\npassive' });
    expect(api.putTemplateContent.mock.calls[1][1].baseFields).toHaveLength(2);
    expect(api.putTemplateContent.mock.calls[1][1].baseFields).toEqual([
      expect.objectContaining({ id: 'base-a', title: 'Alpha draft' }),
      expect.objectContaining({ id: 'base-b', title: 'Beta' }),
    ]);
    expect(baseTitle('Beta draft')).toHaveValue('Beta draft');
    expect(saveBaseButton('Beta draft')).toBeEnabled();
  });

  it('retains local edits while write permissions refresh and gates edits and writes', async () => {
    const view = renderTemplates();
    await screen.findByRole('row', { name: 'Базовое поле Alpha' });
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Draft during refresh' } });
    shared.canWrite = false;
    shared.permissionsLoading = true;
    view.rerender(tree());
    expect(baseTitle('Draft during refresh')).toBeDisabled();
    expect(saveBaseButton('Draft during refresh')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    expect(screen.queryByRole('row', { name: 'Базовое поле Новое поле' })).not.toBeInTheDocument();
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    shared.canWrite = true;
    shared.permissionsLoading = false;
    view.rerender(tree());
    expect(baseTitle('Draft during refresh')).toHaveValue('Draft during refresh');
    expect(shared.dirty).toBe(true);
  });

  it('offers a retry for an unblocked content-read failure without enabling background refresh loops', async () => {
    const view = renderTemplates();
    await screen.findByRole('row', { name: 'Базовое поле Alpha' });
    fireEvent.change(baseTitle('Alpha'), { target: { value: 'Local draft' } });
    api.getTemplateContent.mockRejectedValueOnce(new Error('read failed'));
    shared.invalidation = 1;
    view.rerender(tree());
    expect(await screen.findByRole('button', { name: 'Повторить загрузку' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Перечитать содержимое' })).not.toBeInTheDocument();
    api.getTemplateContent.mockResolvedValueOnce(content(12));
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
    await waitFor(() => expect(api.getTemplateContent).toHaveBeenCalledTimes(3));
    expect(baseTitle('Local draft')).toHaveValue('Local draft');
  });

  it('preserves passive description, hides metadata, and ignores late data from a prior campaign', async () => {
    let resolveOld!: (value: TemplateContentEnvelope) => void;
    api.getTemplateContent.mockImplementation((id: number) => id === 4 ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ ...content(), campaignId: 5, data: { ...content().data, baseFields: [base('five', 'five', 'Campaign 5')] } }));
    renderTemplates();
    fireEvent.click(screen.getByRole('button', { name: 'Другую кампанию' }));
    expect(await screen.findByRole('row', { name: 'Базовое поле Campaign 5' })).toBeInTheDocument();
    await act(async () => resolveOld(content()));
    expect(screen.queryByRole('row', { name: 'Базовое поле Alpha' })).not.toBeInTheDocument();
    expect(api.getTemplateContent).toHaveBeenCalledWith(5);
    expect(api.getTemplate).not.toHaveBeenCalled();
    expect(api.renameTemplate).not.toHaveBeenCalled();
  });
});
