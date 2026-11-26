import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, Checkbox, DataTable, DataTableCell, DragHandle, ModalPortal, Panel, Select } from '@tdn/shared';
import { isLosslessNumber } from 'lossless-json';
import { useDirtyDraft, useWorkspace } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { ApiError } from './Feedback';
import { CampaignApiError } from './api';
import { displayValue } from './json';
import { validateFieldValue } from './ValueInput';
import type { BaseField, BaseFieldInput, JsonValue, ValueType } from './types';
import type { LegacyField, LegacyObject } from './legacyDiscovery';

type ImportRow = { field: LegacyField; sourceIndex: number; valueType?: ValueType; value?: JsonValue; reason?: string };
type ClassifiedImportRow = Omit<ImportRow, 'sourceIndex'>;
type Props = { sources: LegacyObject[]; campaignId: number; onClose: () => void };

const classify = (field: LegacyField): ClassifiedImportRow => {
  const formula = field.data.formula;
  if (typeof formula === 'string' && formula.length > 0) return { field };
  if (formula !== undefined && formula !== null && formula !== '') return { field, reason: 'Формула имеет неподдерживаемый формат' };
  if (!Object.prototype.hasOwnProperty.call(field.data, 'value')) return { field, reason: 'Нет значения по умолчанию' };
  const value = field.data.value;
  let valueType: ValueType;
  if (typeof value === 'boolean') valueType = 'Boolean';
  else if (typeof value === 'string') valueType = 'String';
  else if (typeof value === 'number' || isLosslessNumber(value)) valueType = 'Integer';
  else return { field, reason: 'Значение должно быть строкой, логическим значением или целым числом' };
  const issue = validateFieldValue({ valueType, options: [] }, value);
  return issue ? { field, valueType, value, reason: issue } : { field, valueType, value };
};

const toInput = (row: ImportRow): BaseFieldInput => ({
  key: row.field.key,
  title: row.field.name,
  description: typeof row.field.data.description === 'string' ? row.field.data.description : '',
  valueType: row.valueType!,
  value: row.value!,
  options: []
});

const projectBaseField = (field: BaseField): BaseFieldInput => ({
  id: field.id,
  key: field.key,
  title: field.title,
  description: field.description,
  valueType: field.valueType,
  value: field.value,
  options: field.options
});

const LegacyTemplateFieldImportWizard: React.FC<Props> = ({ sources, campaignId, onClose }) => {
  const { api, sessionKey } = useWorkspace();
  const { mode, permissions, permissionsLoading, reloadPermissions } = useCampaignWorkspace();
  const canWrite = mode === 'gm' && permissions.canWrite && !permissionsLoading;
  const [sourceIndex, setSourceIndex] = useState(sources.length === 1 ? '0' : '');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [order, setOrder] = useState<string[]>();
  const [step, setStep] = useState<1 | 2>(1);
  const [content, setContent] = useState<Awaited<ReturnType<typeof api.getTemplateContent>>>();
  const [loadError, setLoadError] = useState<unknown>();
  const [writeError, setWriteError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [addedCount, setAddedCount] = useState<number>();
  const active = useRef(true);
  const busyRef = useRef(false);
  const draggingKeyRef = useRef<string | undefined>(undefined);
  const source = sourceIndex === '' ? undefined : sources[Number(sourceIndex)];
  const rows = useMemo(() => (source?.fields ?? []).flatMap((field, sourceIndex) => {
    const row = classify(field);
    return row.reason || row.valueType ? [{ ...row, sourceIndex }] : [];
  }), [source]);
  const dirty = selected.size > 0 && addedCount === undefined;
  const clearDirty = useDirtyDraft(`legacy-template-import-${sessionKey}-${campaignId}`, dirty);

  const read = useCallback(async () => {
    if (!canWrite || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setLoadError(undefined);
    try {
      const result = await api.getTemplateContent(campaignId);
      if (!active.current) return;
      setContent(result);
      setSelected(current => new Set([...current].filter(key => {
        const row = rows.find(item => String(item.sourceIndex) === key);
        return row && !result.data.baseFields.some(field => field.key === row.field.key);
      })));
      setOrder(current => current?.filter(key => {
        const row = rows.find(item => String(item.sourceIndex) === key);
        return row && !result.data.baseFields.some(field => field.key === row.field.key);
      }));
      setBlocked(false);
      setWriteError(undefined);
    } catch (error) {
      if (active.current) {
        setLoadError(error);
        if (error instanceof CampaignApiError && error.status === 403) reloadPermissions();
      }
    } finally {
      busyRef.current = false;
      if (active.current) setBusy(false);
    }
  }, [api, campaignId, canWrite, reloadPermissions, rows]);

  useEffect(() => {
    void read();
  }, [read]);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    if (!canWrite) onClose();
  }, [canWrite, onClose]);

  const targetKeys = useMemo(() => new Set(content?.data.baseFields.map(field => field.key) ?? []), [content]);
  const selectableRows = rows.filter(row => !row.reason && !targetKeys.has(row.field.key));
  const selectedRows = selectableRows.filter(row => selected.has(String(row.sourceIndex)));
  const orderedRows = order && order.length === selectedRows.length
    ? order.map(key => selectedRows.find(row => String(row.sourceIndex) === key)).filter((row): row is ImportRow => Boolean(row))
    : selectedRows;
  const toggle = (key: string, checked: boolean) => {
    setSelected(current => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
    setOrder(undefined);
  };

  const moveOrderedRow = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    setOrder(current => {
      const currentOrder = current && current.length === selectedRows.length
        ? current
        : selectedRows.map(row => String(row.sourceIndex));
      const fromIndex = currentOrder.indexOf(fromKey);
      const toIndex = currentOrder.indexOf(toKey);
      if (fromIndex < 0 || toIndex < 0) return currentOrder;
      const next = currentOrder.slice();
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const onHandleKeyDown = (key: string) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key !== 'ArrowUp' && event.key !== 'ArrowDown') || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const currentOrder = order && order.length === selectedRows.length
      ? order
      : selectedRows.map(row => String(row.sourceIndex));
    const index = currentOrder.indexOf(key);
    const target = currentOrder[index + (event.key === 'ArrowUp' ? -1 : 1)];
    if (index < 0 || !target) return;
    event.preventDefault();
    moveOrderedRow(key, target);
  };

  const onHandleDragStart = (key: string) => (event: React.DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData('text/plain', key);
    event.dataTransfer.effectAllowed = 'move';
    draggingKeyRef.current = key;
  };

  const onRowDrop = (key: string) => (event: React.DragEvent<HTMLTableRowElement>) => {
    const fromKey = draggingKeyRef.current || event.dataTransfer.getData('text/plain');
    if (fromKey && fromKey !== key) {
      event.preventDefault();
      moveOrderedRow(fromKey, key);
    }
    draggingKeyRef.current = undefined;
  };

  const clearDrag = () => {
    draggingKeyRef.current = undefined;
  };

  const importSelected = async () => {
    if (!canWrite || busyRef.current || !content || blocked || selectedRows.length === 0) return;
    busyRef.current = true;
    setBusy(true);
    setWriteError(undefined);
    try {
      await api.putTemplateContent(campaignId, {
        expectedRevision: content.contentRevision,
        description: content.data.description,
        baseFields: [...content.data.baseFields.map(projectBaseField), ...orderedRows.map(toInput)]
      });
      if (active.current) setAddedCount(orderedRows.length);
    } catch (error) {
      if (active.current) {
        setWriteError(error);
        if (error instanceof CampaignApiError && (error.conflict || error.unknownOutcome)) setBlocked(true);
        if (error instanceof CampaignApiError && error.status === 403) reloadPermissions();
      }
    } finally {
      busyRef.current = false;
      if (active.current) setBusy(false);
    }
  };

  const changeSource = (value: string) => {
    setSourceIndex(value);
    setSelected(new Set());
    setOrder(undefined);
    setStep(1);
  };

  const goToOrder = () => {
    const selectedKeys = selectedRows.map(row => String(row.sourceIndex));
    setOrder(current => current && current.length === selectedKeys.length && current.every(key => selectedKeys.includes(key))
      ? current
      : selectedKeys);
    setStep(2);
  };

  const goBack = () => {
    setStep(1);
    clearDrag();
  };

  const requestClose = () => {
    if (busyRef.current) return;
    if (dirty && !window.confirm('Выбранные поля не импортированы. Отказаться от текущего выбора?')) return;
    clearDirty();
    onClose();
  };

  return <ModalPortal isOpen onClose={requestClose} title="Импорт базовых полей шаблона" size="wide" dismissDisabled={busy}>
    {step === 1 && sources.length > 1 && <Select aria-label="Источник шаблона" value={sourceIndex} disabled={busy} onChange={event => changeSource(event.target.value)}>
      <option value="">Выберите шаблон</option>
      {sources.map((item, index) => <option key={`${item.name}:${index}`} value={String(index)}>{item.name}</option>)}
    </Select>}
    {!content && !loadError && <p role="status">Загрузка целевого шаблона…</p>}
    {Boolean(loadError) && <><ApiError error={loadError} /><Button type="button" variant="secondary" disabled={busy || !canWrite} onClick={() => void read()}>Повторить загрузку</Button></>}
    {content && blocked && <><p role="status">Перед повторным импортом перечитайте шаблон. Автоматический повтор не выполняется.</p><Button type="button" variant="secondary" disabled={busy || !canWrite} onClick={() => void read()}>Перечитать шаблон</Button></>}
    {source && step === 1 && <Panel title={`Поля шаблона «${source.name}»`}><>
      {content && <DataTable aria-label="Базовые поля старого шаблона">
        <thead><tr><DataTableCell as="th" sizing="control">Импорт</DataTableCell><DataTableCell as="th" sizing="content">Название</DataTableCell><DataTableCell as="th" sizing="content">Ключ</DataTableCell><DataTableCell as="th">Значение и тип</DataTableCell><DataTableCell as="th">Причина</DataTableCell></tr></thead>
        <tbody>{rows.map((row, index) => {
          const duplicate = targetKeys.has(row.field.key);
          const reason = duplicate ? 'Уже есть в шаблоне' : row.reason;
          const label = row.valueType && row.value !== undefined ? `${displayValue(row.value)} (${row.valueType})` : '—';
          return <tr key={`${row.field.key}:${row.sourceIndex}`}>
            <DataTableCell sizing="control"><Checkbox aria-label={`Импортировать поле ${row.field.name}`} checked={selected.has(String(row.sourceIndex))} disabled={Boolean(reason) || busy || !canWrite} onChange={event => toggle(String(row.sourceIndex), event.target.checked)} /></DataTableCell>
            <DataTableCell as="th" scope="row" sizing="content">{row.field.name}</DataTableCell>
            <DataTableCell sizing="content">{row.field.key}</DataTableCell>
            <DataTableCell>{label}</DataTableCell>
            <DataTableCell>{reason ?? '—'}</DataTableCell>
          </tr>;
        })}</tbody>
      </DataTable>}
      {writeError && <ApiError error={writeError} />}
    </></Panel>}
    {source && step === 2 && <Panel title="Порядок новых базовых полей">
      <p>Изменяется порядок только выбранных новых полей. Существующие поля останутся перед ними и сохранят свой порядок.</p>
      <DataTable aria-label="Порядок новых базовых полей">
        <thead><tr><DataTableCell as="th" sizing="control">Порядок</DataTableCell><DataTableCell as="th" sizing="content">Название</DataTableCell><DataTableCell as="th" sizing="content">Ключ</DataTableCell><DataTableCell as="th">Значение и тип</DataTableCell></tr></thead>
        <tbody>{orderedRows.map(row => {
          const key = String(row.sourceIndex);
          return <tr key={key} onDragOver={event => { if (draggingKeyRef.current && draggingKeyRef.current !== key) event.preventDefault(); }} onDrop={onRowDrop(key)}>
            <DataTableCell sizing="control"><DragHandle size="small" label={`Переместить поле ${row.field.name}`} title="Перетащите или используйте стрелки вверх и вниз" disabled={busy || !canWrite} draggable onDragStart={onHandleDragStart(key)} onDragEnd={clearDrag} onKeyDown={onHandleKeyDown(key)} /></DataTableCell>
            <DataTableCell as="th" scope="row" sizing="content">{row.field.name}</DataTableCell>
            <DataTableCell sizing="content">{row.field.key}</DataTableCell>
            <DataTableCell>{`${displayValue(row.value!)} (${row.valueType})`}</DataTableCell>
          </tr>;
        })}</tbody>
      </DataTable>
    </Panel>}
    {addedCount !== undefined && <Panel><p role="status">Добавлено полей: {addedCount}.</p><Button type="button" onClick={requestClose}>Закрыть</Button></Panel>}
    <ActionRow>
      <Button type="button" variant="secondary" disabled={busy} onClick={requestClose}>Отмена</Button>
      {step === 1
        ? <Button type="button" disabled={!source || !canWrite || busy || !content || blocked || selectedRows.length === 0} onClick={goToOrder}>Далее</Button>
        : <><Button type="button" variant="secondary" disabled={busy || addedCount !== undefined} onClick={goBack}>Назад</Button><Button type="button" disabled={!canWrite || busy || !content || blocked || orderedRows.length === 0 || addedCount !== undefined} onClick={() => void importSelected()}>Импортировать выбранные поля</Button></>}
    </ActionRow>
  </ModalPortal>;
};

export default LegacyTemplateFieldImportWizard;
