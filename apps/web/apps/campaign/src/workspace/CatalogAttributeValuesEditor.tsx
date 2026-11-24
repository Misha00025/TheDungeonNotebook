import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, DataTable, DataTableActions, DataTableCell, DataTableNote, Field, IconButton, ModalPortal, Select } from '@tdn/shared';
import { useDirtyDraft } from './Workspace';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence, CatalogEditLevel } from './catalogTypes';
import { catalogAttributeField, catalogAttributeIssue, catalogValueLabel, createCatalogOccurrence, defaultTypedValue } from './catalogModel';
import { stringifyJson } from './json';
import { ValueInput } from './ValueInput';
import CatalogAttributeReadout from './CatalogAttributeReadout';
import styles from './CatalogDefinitionFields.module.css';

export type CatalogAttributeValuesEditorProps = {
  definitions: CatalogAttributeDefinition[];
  values: CatalogAttributeOccurrence[];
  onChange: (values: CatalogAttributeOccurrence[]) => void;
  onValidityChange?: (invalid: boolean) => void;
  disabled?: boolean;
  readOnly?: boolean;
  mode?: 'definition' | 'character';
  sourceValues?: CatalogAttributeOccurrence[];
  savedValues?: CatalogAttributeOccurrence[];
  immutableBindingIds?: string[];
  lockedOccurrenceIds?: string[];
};

export const CatalogAttributeValuesEditor: React.FC<CatalogAttributeValuesEditorProps> = ({
  definitions,
  values,
  onChange,
  onValidityChange,
  disabled = false,
  readOnly = false,
  mode = 'definition',
  sourceValues = [],
  savedValues,
  immutableBindingIds = [],
  lockedOccurrenceIds = [],
}) => {
  const idPrefix = useId();
  const baselineRef = useRef(savedValues ?? values);
  const [inputErrors, setInputErrors] = useState<Record<string, boolean>>({});
  const [newAttributeId, setNewAttributeId] = useState('');
  const [choiceDraft, setChoiceDraft] = useState<{ row: CatalogAttributeOccurrence; value: CatalogAttributeOccurrence['value']; definition: { typeKey: string; options: CatalogAttributeDefinition['options'] }; error?: string }>();
  const validityCallback = useRef(onValidityChange);
  validityCallback.current = onValidityChange;

  const definitionById = useMemo(() => new Map(definitions.map(item => [item.id, item])), [definitions]);
  const baselineById = useMemo(() => new Map((savedValues ?? baselineRef.current).map(row => [row.id, row])), [savedValues]);
  const immutableBindings = useMemo(() => new Set(immutableBindingIds), [immutableBindingIds]);
  const lockedOccurrences = useMemo(() => new Set(lockedOccurrenceIds), [lockedOccurrenceIds]);
  const activeIds = useMemo(() => new Set(values.map(row => row.id)), [values]);
  const editableIds = useMemo(() => new Set(values.filter(row => mode === 'definition' || row.editLevel === 'Character').map(row => row.id)), [values, mode]);
  const changedValueInvalid = values.some(row => {
    const baseline = baselineById.get(row.id);
    if (baseline && stringifyJson(row) === stringifyJson(baseline)) return false;
    if (!editableIds.has(row.id)) return false;
    return Boolean(catalogAttributeIssue(definitionById.get(row.attributeId), row));
  });
  const hasInvalidInput = !readOnly && (changedValueInvalid || Object.entries(inputErrors).some(([id, invalid]) => invalid && activeIds.has(id) && editableIds.has(id)));
  const choiceDraftDirty = Boolean(choiceDraft && stringifyJson(choiceDraft.value) !== stringifyJson(choiceDraft.row.value));
  useDirtyDraft(`catalog-attribute-choice-${idPrefix}`, choiceDraftDirty);

  useEffect(() => {
    const prune = (current: Record<string, boolean>) => {
      const next = Object.fromEntries(Object.entries(current).filter(([id]) => activeIds.has(id)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    };
    setInputErrors(prune);
  }, [activeIds]);

  useEffect(() => {
    validityCallback.current?.(hasInvalidInput);
  }, [hasInvalidInput]);

  useEffect(() => {
    if (!newAttributeId && definitions.length) setNewAttributeId(definitions[0].id);
  }, [definitions, newAttributeId]);

  const updateRow = (rowId: string, next: CatalogAttributeOccurrence) => {
    onChange(values.map(row => row.id === rowId ? next : row));
  };

  const removeRow = (rowId: string) => {
    onChange(values.filter(row => row.id !== rowId));
    setInputErrors(current => { const next = { ...current }; delete next[rowId]; return next; });
  };

  const addOccurrence = () => {
    const definition = definitionById.get(newAttributeId) ?? definitions[0];
    if (!definition) return;
    const row = createCatalogOccurrence(definition, mode === 'character' ? 'Character' : 'Definition');
    if (row) {
      onChange([...values, row]);
    }
  };

  const renderRow = (row: CatalogAttributeOccurrence, source: boolean) => {
    const definition = definitionById.get(row.attributeId);
    const field = catalogAttributeField(definition);
    const issue = definition ? catalogAttributeIssue(definition, row) : 'Характеристика удалена.';
    const characterLocked = mode === 'character' && (row.editLevel !== 'Character' || lockedOccurrences.has(row.id));
    const rowReadOnly = readOnly || source || disabled || characterLocked;
    const canEdit = !rowReadOnly && Boolean(definition && field);
    const canRemove = !rowReadOnly && (mode === 'character' || !immutableBindings.has(row.id));
    const canRebind = canRemove && Boolean(definition) && !immutableBindings.has(row.id);
    const replaceInvalid = () => {
      if (!definition || disabled || readOnly || source || characterLocked) return;
      const value = defaultTypedValue(definition.typeKey, definition.options);
      if (value === undefined) return;
      updateRow(row.id, { id: row.id, attributeId: row.attributeId, editLevel: row.editLevel, value });
      setInputErrors(current => ({ ...current, [row.id]: false }));
    };
    const isMultiChoice = definition?.typeKey === 'multiChoice' && canEdit && field;
    return <tr key={`${source ? 'source-' : ''}${row.id}`}>
      <DataTableCell as="th" scope="row" sizing="editor">{canRebind && definition
        ? <Select aria-label={`Атрибут: ${definition.title}`} value={row.attributeId} disabled={disabled || immutableBindings.has(row.id)} onChange={event => {
          const nextDefinition = definitionById.get(event.target.value);
          if (!nextDefinition) return;
          const next = createCatalogOccurrence(nextDefinition, row.editLevel);
          if (next) updateRow(row.id, { ...next, id: row.id });
        }}>
          {definitions.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </Select>
        : definition?.title ?? 'Характеристика удалена'}
      </DataTableCell>
      <DataTableCell sizing="editor">{rowReadOnly || issue
        ? definition ? catalogValueLabel(row.value, definition) : '—'
        : canEdit && isMultiChoice
          ? <><span>{catalogValueLabel(row.value, definition) || 'Не выбрано'}</span> <Button type="button" size="small" variant="secondary" disabled={disabled} onClick={() => setChoiceDraft({ row, value: row.value, definition: { typeKey: definition.typeKey, options: definition.options }, error: issue })}>Выбрать значения</Button></>
          : canEdit && field && definition
            ? <ValueInput field={field} value={row.value} label={`Значение: ${definition.title}`} compact disabled={disabled} onChange={value => updateRow(row.id, { ...row, value })} onValidityChange={error => setInputErrors(current => current[row.id] === Boolean(error) ? current : { ...current, [row.id]: Boolean(error) })} />
            : catalogValueLabel(row.value, definition)}
        {issue && <DataTableNote role="status" tone="error">{definition ? 'Значение не соответствует текущей характеристике.' : 'Характеристика удалена.'}</DataTableNote>}
      </DataTableCell>
      <DataTableCell sizing="editor">{mode === 'definition' && !rowReadOnly && definition && field
        ? <Select aria-label={`Где разрешено менять: ${definition.title}`} value={row.editLevel} disabled={disabled} onChange={event => updateRow(row.id, { ...row, editLevel: event.target.value as CatalogEditLevel })}>
          <option value="Definition">Только в каталоге</option>
          <option value="Character">Можно менять у персонажа</option>
        </Select>
        : row.editLevel === 'Character' ? 'Можно менять у персонажа' : 'Только в каталоге'}</DataTableCell>
      <DataTableCell sizing="control"><DataTableActions wrap>
        {issue && definition && canEdit && <Button type="button" size="small" disabled={disabled} onClick={replaceInvalid}>Заменить некорректное значение</Button>}
        {canRemove && <IconButton icon="delete" size="small" variant="danger" title="Убрать" ariaLabel="Убрать" disabled={disabled} onClick={() => removeRow(row.id)} />}
        {!definition && !source && !readOnly && <Button type="button" size="small" disabled={disabled} onClick={() => removeRow(row.id)}>Удалить черновик</Button>}
      </DataTableActions></DataTableCell>
    </tr>;
  };

  if (readOnly) return <CatalogAttributeReadout definitions={definitions} values={[...sourceValues, ...values]} showEditRules={mode === 'definition'} />;

  return <section>
    <DataTable aria-label="Характеристики">
      <thead><tr><DataTableCell as="th" scope="col" sizing="editor">Характеристика</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Значение</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Можно менять у персонажа</DataTableCell><DataTableCell as="th" scope="col" sizing="control">Действия</DataTableCell></tr></thead>
      <tbody>{sourceValues.map(row => renderRow(row, true))}{values.map(row => renderRow(row, false))}</tbody>
    </DataTable>
    {!disabled && <ActionRow className={styles.addAttributeRow}>
      <Field label="Новая характеристика" htmlFor={`${idPrefix}-catalog-new-attribute`}>
        <Select id={`${idPrefix}-catalog-new-attribute`} value={newAttributeId} onChange={event => setNewAttributeId(event.target.value)}>
          <option value="">Выберите характеристику</option>
          {definitions.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </Select>
      </Field>
      <Button type="button" onClick={addOccurrence} disabled={!definitions.length}>Добавить характеристику</Button>
    </ActionRow>}
    {hasInvalidInput && <p role="alert">Исправьте некорректные значения перед сохранением.</p>}
    {choiceDraft && (() => {
      const currentRow = values.find(row => row.id === choiceDraft.row.id);
      const currentDefinition = currentRow ? definitionById.get(currentRow.attributeId) : undefined;
      const currentField = catalogAttributeField(currentDefinition);
      const sameBinding = Boolean(currentRow && currentRow.attributeId === choiceDraft.row.attributeId && currentRow.editLevel === choiceDraft.row.editLevel);
      const schemaCurrent = Boolean(currentDefinition && currentDefinition.typeKey === choiceDraft.definition.typeKey && stringifyJson(currentDefinition.options) === stringifyJson(choiceDraft.definition.options) && currentDefinition.typeKey === 'multiChoice');
      const editable = Boolean(currentRow && !disabled && !readOnly && sameBinding && schemaCurrent && currentRow.editLevel === choiceDraft.row.editLevel && !lockedOccurrences.has(currentRow.id) && !immutableBindings.has(currentRow.id));
      const error = currentField ? undefined : 'Схема характеристики недоступна.';
      const validValue = currentField && currentRow ? !catalogAttributeIssue(currentDefinition, { ...currentRow, value: choiceDraft.value }) : false;
      const canApply = Boolean(editable && validValue && !error);
      return <ModalPortal isOpen onClose={() => setChoiceDraft(undefined)} title={`Значения: ${currentDefinition?.title ?? 'характеристика'}`}>
        {!editable && <p role="status">Характеристика или право редактирования изменились. Черновик выбора сохранён.</p>}
        {currentField && editable
          ? <ValueInput field={currentField} value={choiceDraft.value} label={`Значение: ${currentDefinition?.title ?? 'характеристика'}`} onChange={value => setChoiceDraft(current => current ? { ...current, value } : current)} onValidityChange={value => setChoiceDraft(current => current ? { ...current, error: value } : current)} />
          : <p>{currentDefinition?.typeKey === 'multiChoice' ? catalogValueLabel(choiceDraft.value, currentDefinition) : 'Выбор недоступен'}</p>}
        {error && <p role="alert">{error}</p>}
        {choiceDraft.error && <p role="alert">{choiceDraft.error}</p>}
        <ActionRow><Button type="button" disabled={!canApply || Boolean(choiceDraft.error)} onClick={() => {
          if (!canApply || !currentRow) return;
          updateRow(currentRow.id, { ...currentRow, value: choiceDraft.value });
          setChoiceDraft(undefined);
        }}>Применить</Button><Button type="button" variant="secondary" onClick={() => setChoiceDraft(undefined)}>Отмена</Button></ActionRow>
      </ModalPortal>;
    })()}
  </section>;
};

export default CatalogAttributeValuesEditor;
