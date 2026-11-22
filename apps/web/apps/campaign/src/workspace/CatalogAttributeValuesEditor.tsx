import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, Field, Select } from '@tdn/shared';
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
  const validityCallback = useRef(onValidityChange);
  validityCallback.current = onValidityChange;

  const definitionById = useMemo(() => new Map(definitions.map(item => [item.id, item])), [definitions]);
  const diagnosticById = useMemo(() => new Map(diagnostics.map(item => [item.occurrenceId, item.code])), [diagnostics]);
  const immutableBindings = useMemo(() => new Set(immutableBindingIds), [immutableBindingIds]);
  const lockedOccurrences = useMemo(() => new Set(lockedOccurrenceIds), [lockedOccurrenceIds]);
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
    const controlId = `${idPrefix}-attribute-${row.id}`;
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

    return <fieldset key={`${source ? 'source-' : ''}${row.id}`}>
      <legend>{definition?.title ?? 'Неизвестный атрибут'}{!definition?.isActive && ' · неактивен'}{stale && ' · устаревшее значение'}</legend>
      {stale && <p>Значение сохранено без изменения. Оно не будет преобразовано автоматически.</p>}
      {errorMessage && <p role="status">{errorMessage}</p>}
      {rowReadOnly ? <>
        <p>{catalogValueLabel(row.value, definition)}</p>
        <p>{row.editLevel === 'Character' ? 'Можно менять у персонажа' : 'Только в каталоге'}</p>
        {mode === 'character' && !readOnly && !source && <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => removeRow(row.id)}
        >{immutableBindings.has(row.id) ? 'Сбросить к каталогу' : 'Убрать собственное значение'}</Button>}
      </> : <>
        <Field label="Атрибут" htmlFor={`${controlId}-binding`}>
          <Select
            id={`${controlId}-binding`}
            value={row.attributeId}
            disabled={disabled || stale || immutableBindings.has(row.id)}
            onChange={event => {
              const nextDefinition = definitionById.get(event.target.value);
              if (!nextDefinition) return;
              const next = createCatalogOccurrence(nextDefinition, row.editLevel);
              if (next) updateRow(row.id, { ...next, id: row.id });
            }}
          >
            <option value={row.attributeId}>{definition?.title ?? 'Неизвестный атрибут'}</option>
            {definitions.filter(item => item.isActive).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </Select>
        </Field>
        {canEdit && field
          ? <>
            <ValueInput
              field={field}
              value={row.value}
              label={`Значение: ${definition?.title ?? 'атрибут'}`}
              disabled={disabled || stale}
              onChange={value => updateRow(row.id, {
                ...row,
                typeKey: definition.typeKey,
                typeRevision: definition.typeRevision,
                value,
              })}
              onRawChange={() => setChangedRows(current => current[row.id] ? current : { ...current, [row.id]: true })}
              onValidityChange={error => {
                const invalid = Boolean(error);
                setInputErrors(current => current[row.id] === invalid ? current : { ...current, [row.id]: invalid });
              }}
            />
            {definition?.typeKey === 'boolean' && <span>{row.value === true ? 'Да' : 'Нет'}</span>}
          </>
          : <p>{catalogValueLabel(row.value, definition)}</p>}
        {needsExplicitRefresh && definition && <Button type="button" disabled={disabled} onClick={refresh}>
          {stale ? 'Обновить тип значения' : 'Заменить некорректное значение'}
        </Button>}
        {mode === 'definition' && <Field label="Где разрешено менять" htmlFor={`${controlId}-edit-level`}>
          <Select
            id={`${controlId}-edit-level`}
            value={row.editLevel}
            disabled={disabled || stale}
            onChange={event => updateRow(row.id, { ...row, editLevel: event.target.value as CatalogEditLevel })}
          >
            <option value="Definition">Только в каталоге</option>
            <option value="Character">Можно менять у персонажа</option>
          </Select>
        </Field>}
        <Button type="button" variant="secondary" disabled={disabled} onClick={() => removeRow(row.id)}>
          {mode === 'character'
            ? (immutableBindings.has(row.id) ? 'Сбросить к каталогу' : 'Убрать собственное значение')
            : 'Убрать'}
        </Button>
      </>}
    </fieldset>;
  };

  return <section>
    <h3>Атрибуты</h3>
    {sourceValues.map(row => renderRow(row, true))}
    {values.map(row => renderRow(row, false))}
    {!readOnly && !disabled && <div>
      <Field label="Новый атрибут" htmlFor={`${idPrefix}-catalog-new-attribute`}>
        <Select id={`${idPrefix}-catalog-new-attribute`} value={newAttributeId} onChange={event => setNewAttributeId(event.target.value)}>
          <option value="">Выберите атрибут</option>
          {definitions.filter(item => item.isActive).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </Select>
      </Field>
      <Button type="button" onClick={addOccurrence} disabled={!newAttributeId || !definitions.some(item => item.id === newAttributeId && item.isActive && defaultTypedValue(item.typeKey, item.options) !== undefined)}>
        Добавить атрибут
      </Button>
    </div>}
    {hasInvalidInput && <p role="alert">Исправьте некорректные значения перед сохранением.</p>}
  </section>;
};

export default CatalogAttributeValuesEditor;
