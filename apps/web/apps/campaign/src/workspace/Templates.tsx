import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ActionRow, Button, DataTable, DataTableActions, DataTableCell, DataTableNote, DataTableRow, DragHandle, FieldSet, IconButton, Input, Notification, PageHeader, Select } from '@tdn/shared';
import type { ChoiceOption, JsonValue, ValueType, VirtualFieldInput } from './types';
import { useWorkspace } from './Workspace';
import { useResource } from './hooks';
import { useTemplateFields } from './useTemplateFields';
import { rowChange } from './templateFieldRows';
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

export const TemplateEditor: React.FC<{ campaignId: number }> = ({ campaignId }) => {
  const { api, sessionKey } = useWorkspace();
  const fields = useTemplateFields(campaignId);
  const formulas = useResource(`${sessionKey}:${campaignId}:template-formulas`, () => api.listFormulas(campaignId), fields.loaded);
  const [openDialog, setOpenDialog] = useState<OpenDialog>();
  const identity = `${sessionKey}:${campaignId}`;
  const [drag, setDrag] = useState<{ kind: 'base' | 'virtual'; rowKey: string; identity: string }>();
  const dragRef = useRef<typeof drag>(undefined);
  const [hover, setHover] = useState<{ kind: 'base' | 'virtual'; rowKey: string; direction: 'up' | 'down' }>();
  const setCurrentDrag = (value: typeof drag) => { dragRef.current = value; setDrag(value); };
  const dialogDisabled = !fields.writable || fields.busy || fields.blocked;
  const deletedBaseIds = new Set(fields.baseRows.filter(row => row.deleted && row.field.id).map(row => row.field.id));
  const deletedVirtualIds = new Set(fields.virtualRows.filter(row => row.deleted && row.field.id).map(row => row.field.id));
  const savedSources: TemplateFieldSource[] = [
    ...fields.savedBase.flatMap(field => field.id && !deletedBaseIds.has(field.id) ? [{ id: field.id, title: field.title, kind: 'Base' as const }] : []),
    ...fields.savedVirtual.flatMap(field => field.id && !deletedVirtualIds.has(field.id) ? [{ id: field.id, title: field.title, kind: 'Virtual' as const }] : []),
  ];

  const activeBase = openDialog && openDialog.kind.startsWith('base-') ? fields.baseRows.find(row => row.rowKey === openDialog.rowKey && !row.missing && !row.deleted) : undefined;
  const activeVirtual = openDialog && (openDialog.kind === 'virtual-description' || openDialog.kind === 'virtual-links') ? fields.virtualRows.find(row => row.rowKey === openDialog.rowKey && !row.missing && !row.deleted) : undefined;
  const dialogOpen = Boolean(activeBase || activeVirtual);
  const clearDrag = () => { setCurrentDrag(undefined); setHover(undefined); };
  const reorderRows = (kind: 'base' | 'virtual'): { rowKey: string; deleted?: boolean; missing: boolean }[] => kind === 'base' ? fields.baseRows : fields.virtualRows;
  const eligible = (kind: 'base' | 'virtual', key: string) => {
    const rows = reorderRows(kind);
    const row = rows.find(item => item.rowKey === key);
    return Boolean(row && !row.deleted && !row.missing);
  };
  const canReorder = fields.loaded && fields.writable && !fields.busy && !fields.blocked && !dialogOpen;
  useEffect(() => {
    if (!drag) return;
    if (drag.identity !== identity || !canReorder || !eligible(drag.kind, drag.rowKey)) clearDrag();
  }, [drag, identity, canReorder, fields.baseRows, fields.virtualRows]);
  const onHandleDragStart = (kind: 'base' | 'virtual', rowKey: string) => (event: React.DragEvent<HTMLButtonElement>) => {
    if (!canReorder || !eligible(kind, rowKey)) { event.preventDefault(); return; }
    event.dataTransfer.setData('text/plain', rowKey);
    event.dataTransfer.effectAllowed = 'move';
    setCurrentDrag({ kind, rowKey, identity });
  };
  const onRowDragOver = (kind: 'base' | 'virtual', rowKey: string) => (event: React.DragEvent<HTMLTableRowElement>) => {
    const active = dragRef.current;
    if (!active || active.kind !== kind || active.identity !== identity || active.rowKey === rowKey || !canReorder || !eligible(kind, active.rowKey) || !eligible(kind, rowKey)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rows = reorderRows(kind);
    const direction = rows.findIndex(row => row.rowKey === active.rowKey) < rows.findIndex(row => row.rowKey === rowKey) ? 'down' : 'up';
    setHover({ kind, rowKey, direction });
  };
  const onRowDrop = (kind: 'base' | 'virtual', rowKey: string) => (event: React.DragEvent<HTMLTableRowElement>) => {
    const active = dragRef.current;
    if (active && active.kind === kind && active.identity === identity && active.rowKey !== rowKey && canReorder && eligible(kind, active.rowKey) && eligible(kind, rowKey)) {
      event.preventDefault();
      if (kind === 'base') fields.moveBase(active.rowKey, rowKey);
      else fields.moveVirtual(active.rowKey, rowKey);
    }
    clearDrag();
  };
  const onRowDragLeave = (event: React.DragEvent<HTMLTableRowElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setHover(undefined);
  };
  const onHandleKeyDown = (kind: 'base' | 'virtual', rowKey: string) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key !== 'ArrowUp' && event.key !== 'ArrowDown') || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !canReorder) return;
    const rows = reorderRows(kind);
    const index = rows.findIndex(row => row.rowKey === rowKey);
    if (index < 0 || !eligible(kind, rowKey)) return;
    const step = event.key === 'ArrowUp' ? -1 : 1;
    event.preventDefault();
    const candidates = step === -1 ? rows.slice(0, index).reverse() : rows.slice(index + 1);
    const target = candidates.find(row => !row.deleted && !row.missing);
    if (!target) return;
    if (kind === 'base') fields.moveBase(rowKey, target.rowKey);
    else fields.moveVirtual(rowKey, target.rowKey);
    clearDrag();
  };
  const header = <PageHeader
    title="Шаблон кампании"
    headingLevel={1}
    actions={<ActionRow>
      <Button type="button" onClick={() => void fields.saveAll()} disabled={!fields.canSaveAll || dialogOpen} busy={fields.busy}>Сохранить</Button>
      <Button type="button" variant="secondary" onClick={() => {
        if (!fields.dirty || fields.busy) return;
        if (window.confirm('Отменить все изменения шаблона?')) {
          fields.cancelAll();
          setOpenDialog(undefined);
        }
      }} disabled={!fields.loaded || !fields.dirty || fields.busy || dialogOpen}>Отменить</Button>
    </ActionRow>}
  />;

  if (fields.loading && !fields.loaded) return <div className={styles.template}>{header}<p>Загрузка шаблона…</p></div>;
  if (fields.error && !fields.loaded) return <div className={styles.template}>{header}<ApiError error={fields.error} onRetry={() => void fields.reread()} /></div>;

  return <div className={styles.template}>
    {header}
    {Boolean(fields.readError) && <ApiError error={fields.readError} onRetry={fields.blocked ? undefined : () => void fields.reread()} />}
    {Boolean(fields.mutationError) && <ApiError error={fields.mutationError} />}
    {fields.feedback && <Notification kind={fields.feedback.kind} eventKey={fields.feedback.event}>{fields.feedback.message}</Notification>}
    {fields.blocked && <Button type="button" disabled={fields.busy} onClick={() => void fields.reread()}>Перечитать содержимое</Button>}

    <section className={styles.section} aria-labelledby="template-base-fields-heading">
      <header className={styles.sectionHeader}>
        <h2 id="template-base-fields-heading">Базовые поля</h2>
        <ActionRow style={{ gap: '0.5rem' }}><Button type="button" disabled={!fields.writable || fields.busy || fields.blocked} onClick={fields.addBase}>Добавить поле</Button></ActionRow>
      </header>
      <DataTable aria-label="Базовые поля">
        <thead><tr><DataTableCell as="th" scope="col" sizing="control" aria-label="Порядок">#</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Ключ</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Название</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Тип</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">По умолчанию</DataTableCell><DataTableCell as="th" scope="col" sizing="control">Действия</DataTableCell></tr></thead>
        <tbody>{fields.baseRows.map(row => {
          const label = labelOf(row.field);
          const change = rowChange(row);
          const actionDisabled = !fields.writable || fields.busy || fields.blocked || row.missing || Boolean(row.deleted);
          const validationError = row.validationError ?? validateFieldValue({ valueType: row.field.valueType, options: row.field.options }, row.field.value);
          const changeLabel = change ? { modified: 'Изменено', added: 'Добавлено', deleted: 'Удалено' }[change] : undefined;
          return <DataTableRow key={row.rowKey} aria-label={`Базовое поле ${label}`} change={change} dragging={drag?.kind === 'base' && drag.rowKey === row.rowKey} dropPosition={hover?.kind === 'base' && hover.rowKey === row.rowKey ? hover.direction === 'up' ? 'before' : 'after' : undefined} title={changeLabel} aria-description={changeLabel} onDragOver={onRowDragOver('base', row.rowKey)} onDrop={onRowDrop('base', row.rowKey)} onDragLeave={onRowDragLeave}>
            <DataTableCell sizing="control"><DragHandle size="small" label={`Переместить базовое поле ${label}`} title="Перетащите или используйте стрелки вверх и вниз" disabled={!canReorder || row.missing || Boolean(row.deleted)} draggable onDragStart={onHandleDragStart('base', row.rowKey)} onDragEnd={clearDrag} onKeyDown={onHandleKeyDown('base', row.rowKey)} /></DataTableCell>
            <DataTableCell sizing="editor"><Input variant="embedded" aria-label={`Ключ базового поля ${label}`} value={row.field.key} disabled={Boolean(row.field.id) || actionDisabled} onChange={event => fields.changeBase(row.rowKey, field => ({ ...field, key: event.target.value }))} /></DataTableCell>
            <DataTableCell sizing="editor"><Input variant="embedded" aria-label={`Название базового поля ${label}`} value={row.field.title} disabled={actionDisabled} onChange={event => fields.changeBase(row.rowKey, field => ({ ...field, title: event.target.value }))} /></DataTableCell>
            <DataTableCell sizing="editor"><DataTableActions wrap>
              <Select variant="embedded" aria-label={`Тип базового поля ${label}`} value={row.field.valueType} disabled={actionDisabled} onChange={event => {
                const valueType = event.target.value as ValueType;
                fields.changeBase(row.rowKey, field => ({ ...field, valueType, value: defaultFor(valueType), options: isChoice(valueType) ? field.options : [] }));
                fields.setBaseValidity(row.rowKey, undefined);
              }}>{Object.entries(valueTypeLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</Select>
               {isChoice(row.field.valueType) && <Button type="button" size="small" disabled={actionDisabled} onClick={() => setOpenDialog({ kind: 'base-options', rowKey: row.rowKey })}>Варианты</Button>}
            </DataTableActions></DataTableCell>
            <DataTableCell sizing="editor">
              {row.field.valueType === 'MultiChoice'
                ? <>
                    <Button type="button" size="small" disabled={actionDisabled} onClick={() => setOpenDialog({ kind: 'base-choice', rowKey: row.rowKey })}>Выбрано: {Array.isArray(row.field.value) ? row.field.value.length : 0}</Button>
                  {validationError && <DataTableNote tone="error" role="alert">{validationError}</DataTableNote>}
                </>
                : <FieldSet disabled={actionDisabled}>
                  <ValueInput variant="embedded" compact key={`${row.rowKey}:${row.resetKey}`} field={{ valueType: row.field.valueType, options: row.field.options }} value={row.field.value} label={`Значение по умолчанию ${label}`} onChange={value => fields.changeBase(row.rowKey, field => ({ ...field, value }))} onValidityChange={error => fields.setBaseValidity(row.rowKey, error)} />
                </FieldSet>}
              {row.field.valueType !== 'MultiChoice' && validationError && row.field.valueType !== 'Integer' && row.field.valueType !== 'Number' && <DataTableNote tone="error" role="alert">{validationError}</DataTableNote>}
            </DataTableCell>
            <DataTableCell sizing="control"><DataTableActions>
                <IconButton icon="edit" size="small" title={`Описание базового поля ${label}`} ariaLabel={`Описание базового поля ${label}`} disabled={actionDisabled} onClick={() => setOpenDialog({ kind: 'base-description', rowKey: row.rowKey })} />
               {row.deleted
                 ? <IconButton icon="undo" variant="secondary" size="small" title={`Восстановить базовое поле ${label}`} ariaLabel={`Восстановить базовое поле ${label}`} disabled={!fields.writable || fields.busy || fields.blocked} onClick={() => fields.restoreBase(row.rowKey)} />
                  : <IconButton icon="delete" size="small" variant="danger" title={`Удалить базовое поле ${label}`} ariaLabel={`Удалить базовое поле ${label}`} disabled={!fields.writable || fields.busy || fields.blocked || row.missing} onClick={() => fields.deleteBase(row.rowKey)} />}
             </DataTableActions>{row.missing && <DataTableNote tone="error" role="alert">Поле удалено на сервере. Отмените черновик.</DataTableNote>}</DataTableCell>
          </DataTableRow>;
        })}</tbody>
      </DataTable>
    </section>

    <section className={styles.section} aria-labelledby="template-virtual-fields-heading" aria-busy={formulas.loading || undefined}>
      <header className={styles.sectionHeader}>
        <h2 id="template-virtual-fields-heading">Виртуальные поля</h2>
        <ActionRow style={{ gap: '0.5rem' }}><Button type="button" disabled={!fields.writable || fields.busy || fields.blocked} onClick={fields.addVirtual}>Добавить виртуальное поле</Button></ActionRow>
      </header>
      {Boolean(formulas.error) && <ApiError error={formulas.error} onRetry={formulas.reload} />}
      <DataTable aria-label="Виртуальные поля">
        <thead><tr><DataTableCell as="th" scope="col" sizing="control" aria-label="Порядок">#</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Ключ</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Название</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Тип</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Формула</DataTableCell><DataTableCell as="th" scope="col" sizing="control">Связи</DataTableCell><DataTableCell as="th" scope="col" sizing="control">Действия</DataTableCell></tr></thead>
        <tbody>{fields.virtualRows.map(row => {
          const label = labelOf(row.field);
          const change = rowChange(row);
          const actionDisabled = !fields.writable || fields.busy || fields.blocked || row.missing || Boolean(row.deleted);
          const changeLabel = change ? { modified: 'Изменено', added: 'Добавлено', deleted: 'Удалено' }[change] : undefined;
          const formula = formulas.data?.find(item => item.id === row.field.formulaId);
          const knownFormula = Boolean(formula);
          return <DataTableRow key={row.rowKey} aria-label={`Виртуальное поле ${label}`} change={change} dragging={drag?.kind === 'virtual' && drag.rowKey === row.rowKey} dropPosition={hover?.kind === 'virtual' && hover.rowKey === row.rowKey ? hover.direction === 'up' ? 'before' : 'after' : undefined} title={changeLabel} aria-description={changeLabel} onDragOver={onRowDragOver('virtual', row.rowKey)} onDrop={onRowDrop('virtual', row.rowKey)} onDragLeave={onRowDragLeave}>
            <DataTableCell sizing="control"><DragHandle size="small" label={`Переместить виртуальное поле ${label}`} title="Перетащите или используйте стрелки вверх и вниз" disabled={!canReorder || row.missing || Boolean(row.deleted)} draggable onDragStart={onHandleDragStart('virtual', row.rowKey)} onDragEnd={clearDrag} onKeyDown={onHandleKeyDown('virtual', row.rowKey)} /></DataTableCell>
            <DataTableCell sizing="editor"><Input variant="embedded" aria-label={`Ключ виртуального поля ${label}`} value={row.field.key} disabled={Boolean(row.field.id) || actionDisabled} onChange={event => fields.changeVirtual(row.rowKey, field => ({ ...field, key: event.target.value }))} /></DataTableCell>
            <DataTableCell sizing="editor"><Input variant="embedded" aria-label={`Название виртуального поля ${label}`} value={row.field.title} disabled={actionDisabled} onChange={event => fields.changeVirtual(row.rowKey, field => ({ ...field, title: event.target.value }))} /></DataTableCell>
            <DataTableCell sizing="editor"><Select variant="embedded" aria-label={`Тип виртуального поля ${label}`} value={row.field.resultType} disabled={actionDisabled} onChange={event => fields.changeVirtual(row.rowKey, field => ({ ...field, resultType: event.target.value as VirtualFieldInput['resultType'] }))}><option value="Integer">Целое число</option><option value="Number">Дробное число</option></Select></DataTableCell>
            <DataTableCell sizing="editor"><Select variant="embedded" aria-label={`Формула виртуального поля ${label}`} value={row.field.formulaId} disabled={actionDisabled} onChange={event => fields.changeVirtual(row.rowKey, field => ({ ...field, formulaId: event.target.value }))}>
              <option value="">Выберите формулу</option>
              {!knownFormula && row.field.formulaId && <option value={row.field.formulaId}>Недоступная формула</option>}
              {(formulas.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select></DataTableCell>
            <DataTableCell sizing="control"><Button size="small" type="button" disabled={actionDisabled} onClick={() => setOpenDialog({ kind: 'virtual-links', rowKey: row.rowKey })}>Настроить</Button></DataTableCell>
            <DataTableCell sizing="control"><DataTableActions>
              <IconButton icon="edit" size="small" title={`Описание виртуального поля ${label}`} ariaLabel={`Описание виртуального поля ${label}`} disabled={actionDisabled} onClick={() => setOpenDialog({ kind: 'virtual-description', rowKey: row.rowKey })} />
               {row.deleted
                 ? <IconButton icon="undo" variant="secondary" size="small" title={`Восстановить виртуальное поле ${label}`} ariaLabel={`Восстановить виртуальное поле ${label}`} disabled={!fields.writable || fields.busy || fields.blocked} onClick={() => fields.restoreVirtual(row.rowKey)} />
                  : <IconButton icon="delete" size="small" variant="danger" title={`Удалить виртуальное поле ${label}`} ariaLabel={`Удалить виртуальное поле ${label}`} disabled={!fields.writable || fields.busy || fields.blocked || row.missing} onClick={() => fields.deleteVirtual(row.rowKey)} />}
             </DataTableActions>{row.missing && <DataTableNote tone="error" role="alert">Поле удалено на сервере. Отмените черновик.</DataTableNote>}</DataTableCell>
          </DataTableRow>;
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
  return <main className={styles.page}><TemplateEditor key={`${sessionKey}:${campaignId}`} campaignId={campaignId} /></main>;
};

export default Templates;
