import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ActionRow, Button, DataTable, IconButton, Input, Select } from '@tdn/shared';
import type { BaseFieldInput, ChoiceOption, JsonValue, ValueType, VirtualFieldInput } from './types';
import { useWorkspace } from './Workspace';
import { useResource } from './hooks';
import { useTemplateFields } from './useTemplateFields';
import { rowIsDirty } from './templateFieldRows';
import { ApiError } from './Feedback';
import { ValueInput, validateFieldValue } from './ValueInput';
import {
  TemplateChoiceValueDialog,
  TemplateDescriptionDialog,
  TemplateOptionsDialog,
  TemplateVirtualLinksDialog,
} from './TemplateFieldDialogs';
import type { TemplateFieldSource, VirtualLinksUpdate } from './TemplateFieldDialogs';
import styles from './Templates.module.css';

const valueTypeLabels: Record<ValueType, string> = {
  Integer: 'Целое число',
  Number: 'Дробное число',
  String: 'Строка',
  Boolean: 'Логическое значение',
  SingleChoice: 'Один вариант',
  MultiChoice: 'Несколько вариантов',
};

const defaultFor = (type: ValueType): JsonValue => type === 'Integer' || type === 'Number' ? 0 : type === 'String' || type === 'SingleChoice' ? '' : type === 'Boolean' ? false : [];
const isChoice = (type: ValueType) => type === 'SingleChoice' || type === 'MultiChoice';
const labelOf = (field: { title: string; key: string }) => field.title || field.key || 'Новое поле';

type OpenDialog =
  | { kind: 'base-description' | 'virtual-description' | 'base-options' | 'base-choice' | 'virtual-links'; rowKey: string };
type SavingRow = { kind: 'base' | 'virtual'; rowKey: string } | undefined;

export const TemplateEditor: React.FC<{ campaignId: number }> = ({ campaignId }) => {
  const { api, sessionKey, invalidation } = useWorkspace();
  const fields = useTemplateFields(campaignId);
  const formulas = useResource(`${sessionKey}:${campaignId}:${invalidation}:template-formulas`, () => api.listFormulas(campaignId), fields.loaded);
  const [openDialog, setOpenDialog] = useState<OpenDialog>();
  const [savingRow, setSavingRow] = useState<SavingRow>();
  const dialogDisabled = !fields.writable || fields.busy || fields.blocked;

  const save = async (kind: 'base' | 'virtual', rowKey: string) => {
    setSavingRow({ kind, rowKey });
    try {
      if (kind === 'base') await fields.saveBase(rowKey);
      else await fields.saveVirtual(rowKey);
    } finally {
      setSavingRow(undefined);
    }
  };

  const savedSources: TemplateFieldSource[] = [
    ...fields.savedBase.flatMap(field => field.id ? [{ id: field.id, title: field.title, kind: 'Base' as const }] : []),
    ...fields.savedVirtual.flatMap(field => field.id ? [{ id: field.id, title: field.title, kind: 'Virtual' as const }] : []),
  ];

  const activeBase = openDialog && openDialog.kind.startsWith('base-') ? fields.baseRows.find(row => row.rowKey === openDialog.rowKey && !row.missing) : undefined;
  const activeVirtual = openDialog && (openDialog.kind === 'virtual-description' || openDialog.kind === 'virtual-links') ? fields.virtualRows.find(row => row.rowKey === openDialog.rowKey && !row.missing) : undefined;

  if (fields.loading && !fields.loaded) return <p>Загрузка шаблона…</p>;
  if (fields.error && !fields.loaded) return <ApiError error={fields.error} onRetry={() => void fields.reread()} />;

  return <div className={styles.template}>
    {Boolean(fields.readError) && <ApiError error={fields.readError} onRetry={fields.blocked ? undefined : () => void fields.reread()} />}
    {Boolean(fields.mutationError) && <ApiError error={fields.mutationError} />}
    {fields.blocked && <Button type="button" disabled={fields.busy} onClick={() => void fields.reread()}>Перечитать содержимое</Button>}

    <section className={styles.section} aria-labelledby="template-base-fields-heading">
      <header className={styles.sectionHeader}>
        <h2 id="template-base-fields-heading">Базовые поля</h2>
        <ActionRow style={{ gap: '0.5rem' }}><Button type="button" disabled={!fields.writable || fields.busy || fields.blocked} onClick={fields.addBase}>Добавить поле</Button></ActionRow>
      </header>
      <DataTable aria-label="Базовые поля" className={styles.baseTable} minWidth="48rem">
        <thead><tr><th scope="col">Ключ</th><th scope="col">Название</th><th scope="col">Тип</th><th scope="col">По умолчанию</th><th scope="col">Действия</th></tr></thead>
        <tbody>{fields.baseRows.map(row => {
          const label = labelOf(row.field);
          const dirty = rowIsDirty(row);
          const validationError = row.validationError ?? validateFieldValue({ valueType: row.field.valueType, options: row.field.options }, row.field.value);
          const incomplete = !row.field.key.trim() || !row.field.title.trim();
          const canSave = fields.writable && !fields.busy && !fields.blocked && !row.missing && dirty && !validationError && !incomplete;
          const actionDisabled = !fields.writable || fields.busy || fields.blocked || row.missing;
          const saveBusy = savingRow?.kind === 'base' && savingRow.rowKey === row.rowKey;
          return <tr key={row.rowKey} aria-label={`Базовое поле ${label}`}>
            <td><Input aria-label={`Ключ базового поля ${label}`} value={row.field.key} disabled={Boolean(row.field.id) || !fields.writable || fields.busy || fields.blocked || row.missing} onChange={event => fields.changeBase(row.rowKey, field => ({ ...field, key: event.target.value }))} /></td>
            <td><Input aria-label={`Название базового поля ${label}`} value={row.field.title} disabled={!fields.writable || fields.busy || fields.blocked || row.missing} onChange={event => fields.changeBase(row.rowKey, field => ({ ...field, title: event.target.value }))} /></td>
            <td><div className={styles.typeCell}>
              <Select aria-label={`Тип базового поля ${label}`} value={row.field.valueType} disabled={!fields.writable || fields.busy || fields.blocked || row.missing} onChange={event => {
                const valueType = event.target.value as ValueType;
                fields.changeBase(row.rowKey, field => ({ ...field, valueType, value: defaultFor(valueType), options: isChoice(valueType) ? field.options : [] }));
                fields.setBaseValidity(row.rowKey, undefined);
              }}>{Object.entries(valueTypeLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</Select>
              {isChoice(row.field.valueType) && <Button type="button" disabled={!fields.writable || fields.busy || fields.blocked || row.missing} onClick={() => setOpenDialog({ kind: 'base-options', rowKey: row.rowKey })}>Варианты</Button>}
            </div></td>
            <td>
              {row.field.valueType === 'MultiChoice'
                ? <>
                  <Button type="button" disabled={!fields.writable || fields.busy || fields.blocked || row.missing} onClick={() => setOpenDialog({ kind: 'base-choice', rowKey: row.rowKey })}>Выбрано: {Array.isArray(row.field.value) ? row.field.value.length : 0}</Button>
                  {validationError && <span className={styles.validationError} role="alert">{validationError}</span>}
                </>
                : <fieldset disabled={!fields.writable || fields.busy || fields.blocked || row.missing} className={styles.valueFieldset}>
                  <ValueInput compact key={`${row.rowKey}:${row.resetKey}`} field={{ valueType: row.field.valueType, options: row.field.options }} value={row.field.value} label={`Значение по умолчанию ${label}`} onChange={value => fields.changeBase(row.rowKey, field => ({ ...field, value }))} onValidityChange={error => fields.setBaseValidity(row.rowKey, error)} />
                </fieldset>}
              {row.field.valueType !== 'MultiChoice' && validationError && row.field.valueType !== 'Integer' && row.field.valueType !== 'Number' && <span className={styles.validationError} role="alert">{validationError}</span>}
            </td>
            <td><ActionRow className={styles.rowActions} style={{ gap: '.375rem', flexWrap: 'nowrap' }}>
              <IconButton icon="edit" title={`Описание базового поля ${label}`} ariaLabel={`Описание базового поля ${label}`} disabled={actionDisabled} onClick={() => setOpenDialog({ kind: 'base-description', rowKey: row.rowKey })} />
              {dirty && <>
                <IconButton icon="check" title={`Сохранить базовое поле ${label}`} ariaLabel={`Сохранить базовое поле ${label}`} disabled={!canSave} busy={saveBusy} onClick={() => void save('base', row.rowKey)} />
                <IconButton icon="close" title={`Отменить изменения базового поля ${label}`} ariaLabel={`Отменить изменения базового поля ${label}`} disabled={!fields.writable || fields.busy} onClick={() => fields.cancelBase(row.rowKey)} />
              </>}
              <IconButton icon="delete" variant="danger" title={`Удалить базовое поле ${label}`} ariaLabel={`Удалить базовое поле ${label}`} disabled={!fields.writable || fields.busy || (Boolean(row.field.id) && (fields.blocked || row.missing))} onClick={() => {
                if (!row.field.id) { fields.cancelBase(row.rowKey); return; }
                if (!window.confirm(`Удалить поле «${label}»?`)) return;
                void fields.deleteBase(row.rowKey);
              }} />
            </ActionRow>{row.missing && <span className={styles.missingNotice} role="alert">Поле удалено на сервере. Отмените черновик.</span>}</td>
          </tr>;
        })}</tbody>
      </DataTable>
    </section>

    <section className={styles.section} aria-labelledby="template-virtual-fields-heading">
      <header className={styles.sectionHeader}>
        <h2 id="template-virtual-fields-heading">Виртуальные поля</h2>
        <ActionRow style={{ gap: '0.5rem' }}><Button type="button" disabled={!fields.writable || fields.busy || fields.blocked} onClick={fields.addVirtual}>Добавить виртуальное поле</Button></ActionRow>
      </header>
      {formulas.loading && <p>Загрузка формул…</p>}
      {Boolean(formulas.error) && <ApiError error={formulas.error} onRetry={formulas.reload} />}
      <DataTable aria-label="Виртуальные поля" className={styles.virtualTable} minWidth="48rem">
        <thead><tr><th scope="col">Ключ</th><th scope="col">Название</th><th scope="col">Тип</th><th scope="col">Формула</th><th scope="col">Связи</th><th scope="col">Действия</th></tr></thead>
        <tbody>{fields.virtualRows.map(row => {
          const label = labelOf(row.field);
          const dirty = rowIsDirty(row);
          const incomplete = !row.field.key.trim() || !row.field.title.trim();
          const canSave = fields.writable && !fields.busy && !fields.blocked && !row.missing && dirty && !incomplete && Boolean(row.field.formulaId.trim());
          const actionDisabled = !fields.writable || fields.busy || fields.blocked || row.missing;
          const formula = formulas.data?.find(item => item.id === row.field.formulaId);
          const knownFormula = Boolean(formula);
          const saveBusy = savingRow?.kind === 'virtual' && savingRow.rowKey === row.rowKey;
          return <tr key={row.rowKey} aria-label={`Виртуальное поле ${label}`}>
            <td><Input aria-label={`Ключ виртуального поля ${label}`} value={row.field.key} disabled={Boolean(row.field.id) || !fields.writable || fields.busy || fields.blocked || row.missing} onChange={event => fields.changeVirtual(row.rowKey, field => ({ ...field, key: event.target.value }))} /></td>
            <td><Input aria-label={`Название виртуального поля ${label}`} value={row.field.title} disabled={!fields.writable || fields.busy || fields.blocked || row.missing} onChange={event => fields.changeVirtual(row.rowKey, field => ({ ...field, title: event.target.value }))} /></td>
            <td><Select aria-label={`Тип виртуального поля ${label}`} value={row.field.resultType} disabled={!fields.writable || fields.busy || fields.blocked || row.missing} onChange={event => fields.changeVirtual(row.rowKey, field => ({ ...field, resultType: event.target.value as VirtualFieldInput['resultType'] }))}><option value="Integer">Целое число</option><option value="Number">Дробное число</option></Select></td>
            <td><Select aria-label={`Формула виртуального поля ${label}`} value={row.field.formulaId} disabled={!fields.writable || fields.busy || fields.blocked || row.missing} onChange={event => fields.changeVirtual(row.rowKey, field => ({ ...field, formulaId: event.target.value }))}>
              <option value="">Выберите формулу</option>
              {!knownFormula && row.field.formulaId && <option value={row.field.formulaId}>Недоступная формула</option>}
              {(formulas.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select></td>
            <td><Button type="button" disabled={actionDisabled} onClick={() => setOpenDialog({ kind: 'virtual-links', rowKey: row.rowKey })}>Настроить</Button></td>
            <td><ActionRow className={styles.rowActions} style={{ gap: '.375rem', flexWrap: 'nowrap' }}>
              <IconButton icon="edit" title={`Описание виртуального поля ${label}`} ariaLabel={`Описание виртуального поля ${label}`} disabled={actionDisabled} onClick={() => setOpenDialog({ kind: 'virtual-description', rowKey: row.rowKey })} />
              {dirty && <>
                <IconButton icon="check" title={`Сохранить виртуальное поле ${label}`} ariaLabel={`Сохранить виртуальное поле ${label}`} disabled={!canSave} busy={saveBusy} onClick={() => void save('virtual', row.rowKey)} />
                <IconButton icon="close" title={`Отменить изменения виртуального поля ${label}`} ariaLabel={`Отменить изменения виртуального поля ${label}`} disabled={!fields.writable || fields.busy} onClick={() => fields.cancelVirtual(row.rowKey)} />
              </>}
              <IconButton icon="delete" variant="danger" title={`Удалить виртуальное поле ${label}`} ariaLabel={`Удалить виртуальное поле ${label}`} disabled={!fields.writable || fields.busy || (Boolean(row.field.id) && (fields.blocked || row.missing))} onClick={() => {
                if (!row.field.id) { fields.cancelVirtual(row.rowKey); return; }
                if (!window.confirm(`Удалить поле «${label}»?`)) return;
                void fields.deleteVirtual(row.rowKey);
              }} />
            </ActionRow>{row.missing && <span className={styles.missingNotice} role="alert">Поле удалено на сервере. Отмените черновик.</span>}</td>
          </tr>;
        })}</tbody>
      </DataTable>
    </section>

    {openDialog?.kind === 'base-description' && activeBase && <TemplateDescriptionDialog key={openDialog.rowKey} label={labelOf(activeBase.field)} value={activeBase.field.description} disabled={dialogDisabled} onClose={() => setOpenDialog(undefined)} onApply={value => { fields.changeBase(activeBase.rowKey, field => ({ ...field, description: value })); setOpenDialog(undefined); }} />}
    {openDialog?.kind === 'virtual-description' && activeVirtual && <TemplateDescriptionDialog key={openDialog.rowKey} label={labelOf(activeVirtual.field)} value={activeVirtual.field.description} disabled={dialogDisabled} onClose={() => setOpenDialog(undefined)} onApply={value => { fields.changeVirtual(activeVirtual.rowKey, field => ({ ...field, description: value })); setOpenDialog(undefined); }} />}
    {openDialog?.kind === 'base-options' && activeBase && <TemplateOptionsDialog key={openDialog.rowKey} label={labelOf(activeBase.field)} options={activeBase.field.options} disabled={dialogDisabled} onClose={() => setOpenDialog(undefined)} onApply={(options: ChoiceOption[]) => { fields.changeBase(activeBase.rowKey, field => ({ ...field, options })); setOpenDialog(undefined); }} />}
    {openDialog?.kind === 'base-choice' && activeBase && <TemplateChoiceValueDialog key={openDialog.rowKey} label={labelOf(activeBase.field)} field={{ valueType: activeBase.field.valueType, options: activeBase.field.options }} value={activeBase.field.value} disabled={dialogDisabled} onClose={() => setOpenDialog(undefined)} onApply={value => { fields.changeBase(activeBase.rowKey, field => ({ ...field, value })); setOpenDialog(undefined); }} />}
    {openDialog?.kind === 'virtual-links' && activeVirtual && <TemplateVirtualLinksDialog key={openDialog.rowKey} label={labelOf(activeVirtual.field)} campaignId={campaignId} field={activeVirtual.field} sources={savedSources} disabled={dialogDisabled} onClose={() => setOpenDialog(undefined)} onApply={(update: VirtualLinksUpdate) => { fields.changeVirtual(activeVirtual.rowKey, field => ({ ...field, ...update })); setOpenDialog(undefined); }} />}
  </div>;
};

const Templates: React.FC = () => {
  const { groupId = '' } = useParams();
  const campaignId = Number(groupId);
  const { sessionKey } = useWorkspace();
  return <main className={styles.page}><h1>Шаблон кампании</h1><TemplateEditor key={`${sessionKey}:${campaignId}`} campaignId={campaignId} /></main>;
};

export default Templates;
