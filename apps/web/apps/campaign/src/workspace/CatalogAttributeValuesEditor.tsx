import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, DataTable, Field, IconButton, ModalPortal, Select } from '@tdn/shared';
import { useDirtyDraft } from './Workspace';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence, CatalogEditLevel } from './catalogTypes';
import { catalogValueLabel, catalogValueType, createCatalogOccurrence, defaultTypedValue } from './catalogModel';
import { ValueInput, validateFieldValue } from './ValueInput';

export type CatalogAttributeDiagnostic = { occurrenceId: string; code: string };

export type CatalogAttributeValuesEditorProps = {
  definitions: CatalogAttributeDefinition[];
  values: CatalogAttributeOccurrence[];
  onChange: (values: CatalogAttributeOccurrence[]) => void;
  onValidityChange?: (invalid: boolean) => void;
  disabled?: boolean;
  readOnly?: boolean;
  mode?: 'definition' | 'character';
  sourceValues?: CatalogAttributeOccurrence[];
  diagnostics?: CatalogAttributeDiagnostic[];
  immutableBindingIds?: string[];
  lockedOccurrenceIds?: string[];
};

const diagnosticLabels: Record<string, string> = {
  unknown_attribute: 'Атрибут отсутствует в текущей схеме.',
  incompatible_attribute_type: 'Тип атрибута отличается от текущей схемы.',
  invalid_attribute_value: 'Значение не соответствует текущей схеме.',
  attribute_binding_changed: 'Связь собственного значения с атрибутом изменилась; оно не применяется.',
  edit_level_changed: 'Уровень редактирования значения изменился; оно не применяется.',
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
  diagnostics = [],
  immutableBindingIds = [],
  lockedOccurrenceIds = [],
}) => {
  const idPrefix = useId();
  const [inputErrors, setInputErrors] = useState<Record<string, boolean>>({});
  const [changedRows, setChangedRows] = useState<Record<string, boolean>>({});
  const [newAttributeId, setNewAttributeId] = useState('');
  const [choiceDraft, setChoiceDraft] = useState<{ row: CatalogAttributeOccurrence; value: CatalogAttributeOccurrence['value']; error?: string }>();
  const validityCallback = useRef(onValidityChange);
  validityCallback.current = onValidityChange;

  const definitionById = useMemo(() => new Map(definitions.map(item => [item.id, item])), [definitions]);
  const diagnosticById = useMemo(() => new Map(diagnostics.map(item => [item.occurrenceId, item.code])), [diagnostics]);
  const immutableBindings = useMemo(() => new Set(immutableBindingIds), [immutableBindingIds]);
  const lockedOccurrences = useMemo(() => new Set(lockedOccurrenceIds), [lockedOccurrenceIds]);
  const choiceDraftDirty = Boolean(choiceDraft && JSON.stringify(choiceDraft.value) !== JSON.stringify(choiceDraft.row.value));
  useDirtyDraft(`catalog-attribute-choice-${idPrefix}`, choiceDraftDirty);
  const activeIds = useMemo(() => new Set(values.map(row => row.id)), [values]);
  const editableIds = useMemo(() => new Set(values.filter(row => mode === 'definition' || row.editLevel === 'Character').map(row => row.id)), [values, mode]);
  const changedValueInvalid = values.some(row => {
    if (!changedRows[row.id] || !editableIds.has(row.id)) return false;
    const definition = definitionById.get(row.attributeId);
    const valueType = catalogValueType(row.typeKey);
    if (!definition || !valueType || definition.typeKey !== row.typeKey || String(definition.typeRevision) !== String(row.typeRevision)) return false;
    return validateFieldValue({ valueType, options: definition.options }, row.value) !== undefined;
  });
  const hasInvalidInput = !readOnly && (changedValueInvalid || Object.entries(inputErrors).some(([id, invalid]) => invalid && activeIds.has(id) && editableIds.has(id) && changedRows[id]));

  useEffect(() => {
    const prune = (current: Record<string, boolean>) => {
      const next = Object.fromEntries(Object.entries(current).filter(([id]) => activeIds.has(id)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    };
    setInputErrors(prune);
    setChangedRows(prune);
  }, [activeIds]);

  useEffect(() => {
    validityCallback.current?.(hasInvalidInput);
  }, [hasInvalidInput]);

  useEffect(() => {
    if (!newAttributeId && definitions.some(item => item.isActive)) {
      setNewAttributeId(definitions.find(item => item.isActive)?.id ?? '');
    }
  }, [definitions, newAttributeId]);

  const addOccurrence = () => {
    const definition = definitions.find(item => item.id === newAttributeId && item.isActive)
      ?? definitions.find(item => item.isActive);
    if (!definition) return;
    const row = createCatalogOccurrence(definition, mode === 'character' ? 'Character' : 'Definition');
    if (row) {
      setChangedRows(current => ({ ...current, [row.id]: true }));
      onChange([...values, row]);
    }
  };

  const updateRow = (rowId: string, next: CatalogAttributeOccurrence, changed = true) => {
    if (changed) setChangedRows(current => ({ ...current, [rowId]: true }));
    onChange(values.map(row => row.id === rowId ? next : row));
  };

  const fieldFor = (row: CatalogAttributeOccurrence) => {
    const definition = definitionById.get(row.attributeId);
    const valueType = catalogValueType(row.typeKey);
    return valueType ? { valueType, options: definition?.options ?? [] } : undefined;
  };

  const removeRow = (rowId: string) => {
    onChange(values.filter(row => row.id !== rowId));
    setInputErrors(current => {
      if (!(rowId in current)) return current;
      const next = { ...current };
      delete next[rowId];
      return next;
    });
    setChangedRows(current => {
      if (!(rowId in current)) return current;
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  };

  const renderRow = (row: CatalogAttributeOccurrence, source: boolean) => {
    const definition = definitionById.get(row.attributeId);
    const mappedType = catalogValueType(row.typeKey);
    const characterLocked = mode === 'character' && (row.editLevel !== 'Character' || lockedOccurrences.has(row.id));
    const stale = !definition
      || definition.typeKey !== row.typeKey
      || String(definition.typeRevision) !== String(row.typeRevision)
      || !mappedType;
    const rowReadOnly = readOnly || source || disabled || characterLocked;
    const canEdit = !rowReadOnly && !stale;
    const errorCode = diagnosticById.get(row.id);
    const errorMessage = errorCode ? diagnosticLabels[errorCode] ?? 'Сервер обнаружил проблему в этой записи.' : undefined;
    const field = mappedType ? { valueType: mappedType, options: definition?.options ?? [] } : undefined;
    const currentValid = field ? validateFieldValue(field, row.value) === undefined : false;
    const needsExplicitRefresh = stale || Boolean(errorCode && !currentValid);

    const refresh = () => {
      if (!definition || disabled || readOnly || source) return;
      const nextValue = defaultTypedValue(definition.typeKey, definition.options);
      if (nextValue === undefined) return;
      updateRow(row.id, {
        ...row,
        typeKey: definition.typeKey,
        typeRevision: definition.typeRevision,
        value: nextValue,
      });
      setInputErrors(current => ({ ...current, [row.id]: false }));
    };

    const attributeLabel = `${definition?.title ?? 'Неизвестный атрибут'}${!definition?.isActive ? ' · неактивен' : ''}${stale ? ' · устаревшее значение' : ''}`;
    const multipleChoice = mappedType === 'MultiChoice' && canEdit && field;
    const canRebind = !rowReadOnly && !immutableBindings.has(row.id);
    return <tr key={`${source ? 'source-' : ''}${row.id}`}>
      <th scope="row">{canRebind
        ? <Select aria-label={`Атрибут: ${definition?.title ?? 'неизвестный атрибут'}`} value={row.attributeId} disabled={disabled || stale || immutableBindings.has(row.id)} onChange={event => {
          const nextDefinition = definitionById.get(event.target.value);
          if (!nextDefinition) return;
          const next = createCatalogOccurrence(nextDefinition, row.editLevel);
          if (next) updateRow(row.id, { ...next, id: row.id });
        }}>
          <option value={row.attributeId}>{definition?.title ?? 'Неизвестный атрибут'}</option>
          {definitions.filter(item => item.isActive).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </Select>
        : attributeLabel}{stale && <small> Значение сохранено без изменения. Оно не будет преобразовано автоматически.</small>}{errorMessage && <small role="status">{errorMessage}</small>}</th>
      <td>{rowReadOnly
        ? catalogValueLabel(row.value, definition)
        : multipleChoice
          ? <><span>{catalogValueLabel(row.value, definition) || 'Не выбрано'}</span> <Button type="button" size="small" variant="secondary" disabled={disabled} onClick={() => setChoiceDraft({ row, value: row.value, error: validateFieldValue(field!, row.value) })}>Выбрать значения</Button></>
          : canEdit && field
            ? <ValueInput
              field={field}
              value={row.value}
              label={`Значение: ${definition?.title ?? 'атрибут'}`}
              compact
              inline
              disabled={disabled || stale}
              onChange={value => updateRow(row.id, { ...row, typeKey: definition.typeKey, typeRevision: definition.typeRevision, value })}
              onRawChange={() => setChangedRows(current => current[row.id] ? current : { ...current, [row.id]: true })}
              onValidityChange={error => setInputErrors(current => current[row.id] === Boolean(error) ? current : { ...current, [row.id]: Boolean(error) })}
            />
            : catalogValueLabel(row.value, definition)}
      </td>
      <td>{mode === 'definition'
        ? !rowReadOnly
          ? <Select aria-label={`Где разрешено менять: ${definition?.title ?? 'атрибут'}`} value={row.editLevel} disabled={stale} onChange={event => updateRow(row.id, { ...row, editLevel: event.target.value as CatalogEditLevel })}>
          <option value="Definition">Только в каталоге</option><option value="Character">Можно менять у персонажа</option>
          </Select>
          : <>{row.editLevel === 'Character' ? 'Можно менять у персонажа' : 'Только в каталоге'}</>
        : <>{row.editLevel === 'Character' ? 'Можно менять у персонажа' : 'Только в каталоге'}</>}
      </td>
      <td><ActionRow>
        {mode === 'character' && rowReadOnly && !readOnly && !source && <IconButton
          icon="delete"
          size="small"
          variant="danger"
          title={immutableBindings.has(row.id) ? 'Сбросить к каталогу' : 'Убрать собственное значение'}
          ariaLabel={immutableBindings.has(row.id) ? 'Сбросить к каталогу' : 'Убрать собственное значение'}
          disabled={disabled}
          onClick={() => removeRow(row.id)}
        />}
        {!rowReadOnly && needsExplicitRefresh && definition && <Button type="button" size="small" disabled={disabled} onClick={refresh}>
          {stale ? 'Обновить тип значения' : 'Заменить некорректное значение'}
        </Button>}
        {!rowReadOnly && <IconButton
          icon="delete"
          size="small"
          variant="danger"
          title={mode === 'character' ? (immutableBindings.has(row.id) ? 'Сбросить к каталогу' : 'Убрать собственное значение') : 'Убрать'}
          ariaLabel={mode === 'character' ? (immutableBindings.has(row.id) ? 'Сбросить к каталогу' : 'Убрать собственное значение') : 'Убрать'}
          disabled={disabled}
          onClick={() => removeRow(row.id)}
        />}
      </ActionRow></td>
    </tr>;
  };

  return <section>
    <h3>Атрибуты</h3>
    <DataTable aria-label="Атрибуты" minWidth="42rem">
      <thead><tr><th scope="col">Атрибут</th><th scope="col">Значение</th><th scope="col">Изменение</th><th scope="col">Действия</th></tr></thead>
      <tbody>{sourceValues.map(row => renderRow(row, true))}{values.map(row => renderRow(row, false))}</tbody>
    </DataTable>
    {!readOnly && !disabled && <div>
      <ActionRow>
      <Field label="Новый атрибут" htmlFor={`${idPrefix}-catalog-new-attribute`}>
        <Select id={`${idPrefix}-catalog-new-attribute`} value={newAttributeId} onChange={event => setNewAttributeId(event.target.value)}>
          <option value="">Выберите атрибут</option>
          {definitions.filter(item => item.isActive).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </Select>
      </Field>
      <Button type="button" onClick={addOccurrence} disabled={!newAttributeId || !definitions.some(item => item.id === newAttributeId && item.isActive && defaultTypedValue(item.typeKey, item.options) !== undefined)}>
        Добавить атрибут
      </Button></ActionRow>
    </div>}
    {hasInvalidInput && <p role="alert">Исправьте некорректные значения перед сохранением.</p>}
    {choiceDraft && (() => {
      const currentRow = values.find(row => row.id === choiceDraft.row.id);
      const currentDefinition = currentRow ? definitionById.get(currentRow.attributeId) : undefined;
      const currentField = currentRow ? fieldFor(currentRow) : undefined;
      const targetEditable = Boolean(currentRow && !readOnly && !disabled
        && (mode !== 'character' || currentRow.editLevel === 'Character' && !lockedOccurrences.has(currentRow.id)));
      const sameBinding = Boolean(currentRow && currentRow.attributeId === choiceDraft.row.attributeId
        && currentRow.typeKey === choiceDraft.row.typeKey
        && String(currentRow.typeRevision) === String(choiceDraft.row.typeRevision));
      const schemaCurrent = Boolean(currentRow && currentDefinition && currentField
        && currentDefinition.typeKey === currentRow.typeKey
        && String(currentDefinition.typeRevision) === String(currentRow.typeRevision)
        && currentRow.typeKey === 'multiChoice');
      const choiceError = currentField ? validateFieldValue(currentField, choiceDraft.value) : 'Схема атрибута недоступна.';
      const canApplyChoice = targetEditable && sameBinding && schemaCurrent && !choiceError;
      const applyChoice = () => {
        if (!canApplyChoice || !currentRow) return;
        updateRow(currentRow.id, { ...currentRow, value: choiceDraft.value });
        setChoiceDraft(undefined);
      };
      return <ModalPortal isOpen onClose={() => setChoiceDraft(undefined)} title={`Значения: ${currentDefinition?.title ?? 'атрибут'}`}>
        {!targetEditable || !sameBinding || !schemaCurrent
          ? <p role="status">Значение изменилось или редактирование больше недоступно. Закройте диалог и перечитайте запись.</p>
          : <ValueInput field={currentField!} value={choiceDraft.value} label={`Значение: ${currentDefinition?.title ?? 'атрибут'}`} onChange={value => setChoiceDraft(current => {
            const field = currentRow ? fieldFor(currentRow) : undefined;
            return current && field ? { ...current, value, error: validateFieldValue(field, value) } : current;
          })} onValidityChange={error => setChoiceDraft(current => current ? { ...current, error } : current)} />}
        {choiceError && targetEditable && sameBinding && schemaCurrent && <p role="alert">{choiceError}</p>}
        <ActionRow><Button type="button" disabled={!canApplyChoice || Boolean(choiceDraft.error)} onClick={applyChoice}>Применить</Button><Button type="button" variant="secondary" onClick={() => setChoiceDraft(undefined)}>Отмена</Button></ActionRow>
      </ModalPortal>;
    })()}
  </section>;
};

export default CatalogAttributeValuesEditor;
