import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, Field, ModalPortal, Select } from '@tdn/shared';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence, CatalogDiagnostic } from './catalogTypes';
import { catalogAttributeTags } from './catalogAttributeTags';
import { catalogValueType, createCatalogOccurrence, defaultTypedValue } from './catalogModel';
import { stringifyJson } from './json';
import { useDirtyDraft } from './Workspace';
import { ValueInput, validateFieldValue } from './ValueInput';
import styles from './CharacterCatalogAttributes.module.css';

export type CharacterCatalogAttributesProps = {
  definitions: CatalogAttributeDefinition[];
  sourceValues: CatalogAttributeOccurrence[];
  values: CatalogAttributeOccurrence[];
  savedValues?: CatalogAttributeOccurrence[];
  diagnostics?: CatalogDiagnostic[];
  lockedOccurrenceIds?: string[];
  readOnly?: boolean;
  disabled?: boolean;
  onChange: (values: CatalogAttributeOccurrence[]) => void;
  onValidityChange?: (invalid: boolean) => void;
};

type ChoiceDraft = {
  row: CatalogAttributeOccurrence;
  source?: CatalogAttributeOccurrence;
  value: CatalogAttributeOccurrence['value'];
  error?: string;
};

const nonEffectiveDiagnosticCodes = new Set(['attribute_binding_changed', 'edit_level_changed']);

function formatOccurrence(definitions: CatalogAttributeDefinition[], occurrence: CatalogAttributeOccurrence): string {
  return catalogAttributeTags(definitions, [occurrence])[0]?.values.join('; ') ?? '';
}

export const CharacterCatalogAttributes: React.FC<CharacterCatalogAttributesProps> = ({
  definitions,
  sourceValues,
  values,
  savedValues = [],
  diagnostics = [],
  lockedOccurrenceIds = [],
  readOnly = false,
  disabled = false,
  onChange,
  onValidityChange,
}) => {
  const idPrefix = useId();
  const [changedRows, setChangedRows] = useState<Record<string, boolean>>({});
  const [inputErrors, setInputErrors] = useState<Record<string, boolean>>({});
  const [newAttributeId, setNewAttributeId] = useState('');
  const [choiceDraft, setChoiceDraft] = useState<ChoiceDraft>();
  const validityCallback = useRef(onValidityChange);
  validityCallback.current = onValidityChange;

  const definitionById = useMemo(() => new Map(definitions.map(definition => [definition.id, definition])), [definitions]);
  const sourceById = useMemo(() => new Map(sourceValues.map(occurrence => [occurrence.id, occurrence])), [sourceValues]);
  const savedById = useMemo(() => new Map(savedValues.map(occurrence => [occurrence.id, occurrence])), [savedValues]);
  const valuesById = useMemo(() => new Map(values.map(occurrence => [occurrence.id, occurrence])), [values]);
  const diagnosticsById = useMemo(() => new Map(diagnostics.map(diagnostic => [diagnostic.occurrenceId, diagnostic.code])), [diagnostics]);
  const nonEffectiveIds = useMemo(() => new Set(diagnostics
    .filter(diagnostic => nonEffectiveDiagnosticCodes.has(diagnostic.code))
    .map(diagnostic => diagnostic.occurrenceId)), [diagnostics]);
  const lockedIds = useMemo(() => new Set(lockedOccurrenceIds), [lockedOccurrenceIds]);
  const activeIds = useMemo(() => new Set(values.map(occurrence => occurrence.id)), [values]);
  const orderedIds = useMemo(() => [...new Set([...sourceValues, ...savedValues, ...values].map(occurrence => occurrence.id))], [sourceValues, savedValues, values]);
  const supportedDefinitions = useMemo(() => definitions.filter(definition => definition.isActive
    && catalogValueType(definition.typeKey) !== undefined
    && defaultTypedValue(definition.typeKey, definition.options) !== undefined), [definitions]);

  const definitionCurrent = (occurrence: CatalogAttributeOccurrence) => {
    const definition = definitionById.get(occurrence.attributeId);
    return Boolean(definition && definition.isActive && catalogValueType(occurrence.typeKey)
      && definition.typeKey === occurrence.typeKey
      && stringifyJson(definition.typeRevision) === stringifyJson(occurrence.typeRevision));
  };

  const editableLocal = (occurrence: CatalogAttributeOccurrence, source?: CatalogAttributeOccurrence) => {
    return !readOnly && !disabled && occurrence.editLevel === 'Character' && !lockedIds.has(occurrence.id)
      && (!source || source.editLevel === 'Character')
      && !nonEffectiveIds.has(occurrence.id)
      && definitionCurrent(occurrence);
  };

  const directSourceEditable = (occurrence: CatalogAttributeOccurrence) => {
    const definition = definitionById.get(occurrence.attributeId);
    const valueType = catalogValueType(occurrence.typeKey);
    const diagnosticCode = diagnosticsById.get(occurrence.id);
    return !readOnly && !disabled && occurrence.editLevel === 'Character' && !lockedIds.has(occurrence.id)
      && Boolean(definition?.isActive && valueType && definition.typeKey === occurrence.typeKey
        && stringifyJson(definition.typeRevision) === stringifyJson(occurrence.typeRevision))
      && !diagnosticCode
      && validateFieldValue({ valueType: valueType!, options: definition!.options }, occurrence.value) === undefined;
  };

  const changedInvalid = values.some(occurrence => {
    if (!changedRows[occurrence.id] || !editableLocal(occurrence, sourceById.get(occurrence.id))) return false;
    const definition = definitionById.get(occurrence.attributeId);
    const valueType = catalogValueType(occurrence.typeKey);
    return Boolean(definition && valueType
      && validateFieldValue({ valueType, options: definition.options }, occurrence.value) !== undefined);
  });
  const hasInvalidInput = !readOnly && (changedInvalid || Object.entries(inputErrors)
    .some(([id, invalid]) => invalid && activeIds.has(id) && changedRows[id]
      && valuesById.has(id) && editableLocal(valuesById.get(id)!, sourceById.get(id))));
  const choiceDirty = Boolean(choiceDraft && stringifyJson(choiceDraft.value) !== stringifyJson(choiceDraft.row.value));
  useDirtyDraft(`character-catalog-attributes-choice-${idPrefix}`, choiceDirty);

  useEffect(() => {
    const prune = (current: Record<string, boolean>) => {
      const next = Object.fromEntries(Object.entries(current).filter(([id]) => activeIds.has(id)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    };
    setChangedRows(prune);
    setInputErrors(prune);
  }, [activeIds]);

  useEffect(() => {
    validityCallback.current?.(hasInvalidInput);
  }, [hasInvalidInput]);

  useEffect(() => {
    if (!newAttributeId && supportedDefinitions.length) setNewAttributeId(supportedDefinitions[0].id);
  }, [newAttributeId, supportedDefinitions]);

  const updateOccurrence = (id: string, occurrence: CatalogAttributeOccurrence) => {
    setChangedRows(current => ({ ...current, [id]: true }));
    onChange(values.map(item => item.id === id ? occurrence : item));
  };

  const removeLocal = (id: string) => {
    onChange(values.filter(item => item.id !== id));
    setInputErrors(current => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setChangedRows(current => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const restoreSaved = (occurrence: CatalogAttributeOccurrence) => {
    if (valuesById.has(occurrence.id)) return;
    const savedIndex = savedValues.findIndex(item => item.id === occurrence.id);
    let insertionIndex = -1;
    for (let index = savedIndex + 1; index < savedValues.length; index += 1) {
      const nextIndex = values.findIndex(item => item.id === savedValues[index].id);
      if (nextIndex >= 0) {
        insertionIndex = nextIndex;
        break;
      }
    }
    if (insertionIndex < 0) {
      for (let index = savedIndex - 1; index >= 0; index -= 1) {
        const previousIndex = values.findIndex(item => item.id === savedValues[index].id);
        if (previousIndex >= 0) {
          insertionIndex = previousIndex + 1;
          break;
        }
      }
    }
    if (insertionIndex < 0) {
      const firstNewIndex = values.findIndex(item => !savedById.has(item.id));
      insertionIndex = firstNewIndex >= 0 ? firstNewIndex : values.length;
    }
    const nextValues = [...values];
    nextValues.splice(insertionIndex, 0, occurrence);
    onChange(nextValues);
    setChangedRows(current => ({ ...current, [occurrence.id]: false }));
    setInputErrors(current => ({ ...current, [occurrence.id]: false }));
  };

  const addOccurrence = () => {
    const definition = supportedDefinitions.find(item => item.id === newAttributeId);
    if (!definition) return;
    const occurrence = createCatalogOccurrence(definition, 'Character');
    if (!occurrence) return;
    setChangedRows(current => ({ ...current, [occurrence.id]: true }));
    onChange([...values, occurrence]);
  };

  const fieldFor = (occurrence: CatalogAttributeOccurrence) => {
    const valueType = catalogValueType(occurrence.typeKey);
    const definition = definitionById.get(occurrence.attributeId);
    return valueType ? { valueType, options: definition?.options ?? [] } : undefined;
  };

  const refreshStale = (occurrence: CatalogAttributeOccurrence) => {
    const definition = definitionById.get(occurrence.attributeId);
    const source = sourceById.get(occurrence.id);
    if (readOnly || disabled || occurrence.editLevel !== 'Character' || lockedIds.has(occurrence.id)
      || source && source.editLevel !== 'Character' || nonEffectiveIds.has(occurrence.id)
      || !definition?.isActive || !catalogValueType(definition.typeKey)) return;
    const value = defaultTypedValue(definition.typeKey, definition.options);
    if (value === undefined) return;
    updateOccurrence(occurrence.id, { ...occurrence, typeKey: definition.typeKey, typeRevision: definition.typeRevision, value });
    setInputErrors(current => ({ ...current, [occurrence.id]: false }));
  };

  const renderChoiceModal = () => {
    if (!choiceDraft) return null;
    const currentRow = valuesById.get(choiceDraft.row.id);
    const currentSource = sourceById.get(choiceDraft.row.id);
    const currentDefinition = currentRow ? definitionById.get(currentRow.attributeId) : undefined;
    const currentField = currentRow ? fieldFor(currentRow) : undefined;
    const sameBinding = Boolean(currentRow
      && currentRow.attributeId === choiceDraft.row.attributeId
      && currentRow.typeKey === choiceDraft.row.typeKey
      && stringifyJson(currentRow.typeRevision) === stringifyJson(choiceDraft.row.typeRevision)
      && currentRow.editLevel === choiceDraft.row.editLevel);
    const sameSourceBinding = Boolean(Boolean(currentSource) === Boolean(choiceDraft.source)
      && (!currentSource || !choiceDraft.source || currentSource.attributeId === choiceDraft.source.attributeId
        && currentSource.typeKey === choiceDraft.source.typeKey
        && stringifyJson(currentSource.typeRevision) === stringifyJson(choiceDraft.source.typeRevision)
        && currentSource.editLevel === choiceDraft.source.editLevel));
    const schemaCurrent = Boolean(currentRow && currentDefinition?.isActive && currentField
      && currentDefinition.typeKey === currentRow.typeKey
      && stringifyJson(currentDefinition.typeRevision) === stringifyJson(currentRow.typeRevision)
      && currentRow.typeKey === 'multiChoice');
    const canEditChoice = Boolean(currentRow && !readOnly && !disabled && sameBinding && sameSourceBinding && schemaCurrent
      && currentRow.editLevel === 'Character' && (!currentSource || currentSource.editLevel === 'Character')
      && !lockedIds.has(currentRow.id) && !nonEffectiveIds.has(currentRow.id));
    const error = currentField ? validateFieldValue(currentField, choiceDraft.value) : 'Схема характеристики недоступна.';
    const canApply = canEditChoice && !error;
    return <ModalPortal
      isOpen
      title={`Значения: ${currentDefinition?.title ?? 'характеристика'}`}
      onClose={() => setChoiceDraft(undefined)}
      footer={<ActionRow justify="end"><Button type="button" variant="secondary" onClick={() => setChoiceDraft(undefined)}>Отмена</Button><Button type="button" disabled={!canApply || Boolean(error) || Boolean(choiceDraft.error)} onClick={() => {
        if (!canApply || choiceDraft.error || !currentRow) return;
        updateOccurrence(currentRow.id, { ...currentRow, value: choiceDraft.value });
        setChoiceDraft(undefined);
      }}>Применить</Button></ActionRow>}
    >
      {!canEditChoice
        ? <><p role="status">Значение изменилось или редактирование больше недоступно. Черновик сохранён и не применён.</p><p>{formatOccurrence(definitions, { ...choiceDraft.row, value: choiceDraft.value })}</p></>
        : <ValueInput field={currentField!} value={choiceDraft.value} label={`Значение: ${currentDefinition?.title ?? 'характеристика'}`} onChange={value => setChoiceDraft(current => current ? { ...current, value } : current)} onValidityChange={value => setChoiceDraft(current => current ? { ...current, error: value } : current)} />}
      {error && canEditChoice && <p role="alert">{error}</p>}
    </ModalPortal>;
  };

  return <div className={styles.root}>
    {orderedIds.length === 0 && <p>Характеристик пока нет.</p>}
    {orderedIds.map(id => {
      const source = sourceById.get(id);
      const saved = savedById.get(id);
      const local = valuesById.get(id);
      const diagnosticCode = diagnosticsById.get(id);
      const notEffective = Boolean(local && nonEffectiveIds.has(id));
      const effective = notEffective ? source : local ?? source ?? saved;
      const primary = effective ?? local ?? saved ?? source;
      if (!primary) return null;
      const definition = definitionById.get(primary.attributeId);
      const title = definition?.title ?? 'Неизвестная характеристика';
      const locked = lockedIds.has(id);
      const localStale = Boolean(local && !definitionCurrent(local));
      const sourceOnly = Boolean(source && !local && !saved);
      const canEditLocal = Boolean(local && !notEffective && editableLocal(local, source));
      const canOverrideSource = Boolean(sourceOnly && directSourceEditable(source!));
      const canRefresh = Boolean(local && localStale && !notEffective && local.editLevel === 'Character' && !locked && !readOnly && !disabled
        && (!source || source.editLevel === 'Character') && definition?.isActive && catalogValueType(definition.typeKey));
      const savedPendingRemoval = Boolean(saved && !local);
      const changeBaseline = saved ?? source;
      const localChanged = Boolean(local && (!changeBaseline || stringifyJson(local) !== stringifyJson(changeBaseline)));
      const changeLabel = localChanged ? readOnly ? 'Не сохранено' : changeBaseline ? 'Изменено' : 'Добавлено' : undefined;
      const shown = effective ?? local ?? saved ?? source!;
      const valueLabel = formatOccurrence(definitions, shown);
      const isMultiChoice = Boolean(local && catalogValueType(local.typeKey) === 'MultiChoice' && canEditLocal);
      const hasUnappliedWarning = Boolean(local && notEffective);
      const definitionForRow = definitionById.get(local?.attributeId ?? '');
      const canRebind = Boolean(local && !source && !readOnly && !disabled && local.editLevel === 'Character'
        && !locked && definitionForRow && !notEffective);
      const diagnosticMessage = diagnosticCode ? 'Значение требует проверки.' : undefined;

      return <div className={styles.row} key={id}>
        <div className={styles.name}>
          {canRebind && <Select aria-label={`Характеристика: ${title}`} value={local!.attributeId} disabled={disabled || localStale} onChange={event => {
            const nextDefinition = supportedDefinitions.find(item => item.id === event.target.value);
            if (!nextDefinition) return;
            const next = createCatalogOccurrence(nextDefinition, 'Character');
            if (!next) return;
            updateOccurrence(id, { ...next, id });
            setInputErrors(current => ({ ...current, [id]: false }));
          }}>
            <option value={local!.attributeId}>{title}</option>
            {supportedDefinitions.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </Select>}
          {!canRebind && <span>{title}</span>}
        </div>
        <div className={styles.value}>
          {isMultiChoice
            ? <><span>{valueLabel || 'Не выбрано'}</span><Button type="button" size="small" variant="secondary" disabled={disabled} onClick={() => setChoiceDraft({ row: local!, source, value: local!.value, error: validateFieldValue(fieldFor(local!)!, local!.value) })}>Выбрать значения: {title}</Button></>
            : canEditLocal && local
              ? <ValueInput
                field={fieldFor(local)!}
                value={local.value}
                label={`Значение: ${title}`}
                compact
                inline
                disabled={disabled}
                onChange={value => updateOccurrence(id, { ...local, value })}
                onRawChange={() => setChangedRows(current => current[id] ? current : { ...current, [id]: true })}
                onValidityChange={error => setInputErrors(current => current[id] === Boolean(error) ? current : { ...current, [id]: Boolean(error) })}
              />
              : <span className={styles.valueText}>{valueLabel || 'Не задано'}</span>}
          {savedPendingRemoval && <small className={styles.note}>{source ? 'Сброс ожидает сохранения; значение из каталога пока не подтверждено.' : 'Характеристика будет убрана после сохранения.'}</small>}
          {diagnosticMessage && <small className={styles.note}>{diagnosticMessage}</small>}
          {changeLabel && <small className={styles.note}>{changeLabel}</small>}
          {hasUnappliedWarning && <details className={styles.unapplied}><summary>Собственное значение не применяется</summary><span>{formatOccurrence(definitions, local!) || 'Не задано'}</span></details>}
          {canRefresh && <Button type="button" size="small" variant="secondary" disabled={disabled} onClick={() => refreshStale(local!)}>Заменить устаревшее значение</Button>}
        </div>
        <div className={styles.actions}>
          {canOverrideSource && <Button type="button" size="small" variant="secondary" disabled={disabled} onClick={() => {
            if (!source || valuesById.has(id) || !directSourceEditable(source)) return;
            setChangedRows(current => ({ ...current, [id]: true }));
            onChange([...values, source]);
          }}>Изменить: {title}</Button>}
          {savedPendingRemoval && !readOnly && <Button type="button" size="small" variant="secondary" disabled={disabled} onClick={() => restoreSaved(saved!)}>Отменить {source ? 'сброс' : 'удаление'}</Button>}
          {local && !savedPendingRemoval && !readOnly && <Button type="button" size="small" variant="secondary" disabled={disabled} onClick={() => removeLocal(id)}>{source ? `Сбросить к каталогу: ${title}` : `Убрать характеристику: ${title}`}</Button>}
        </div>
      </div>;
    })}
    {!readOnly && <ActionRow className={styles.addRow}>
      <Field label="Новая характеристика" htmlFor={`${idPrefix}-new-attribute`}>
        <Select id={`${idPrefix}-new-attribute`} value={newAttributeId} disabled={disabled || supportedDefinitions.length === 0} onChange={event => setNewAttributeId(event.target.value)}>
          <option value="">Выберите характеристику</option>
          {supportedDefinitions.map(definition => <option key={definition.id} value={definition.id}>{definition.title}</option>)}
        </Select>
      </Field>
      <Button type="button" size="small" disabled={disabled || !supportedDefinitions.some(definition => definition.id === newAttributeId)} onClick={addOccurrence}>Добавить характеристику</Button>
    </ActionRow>}
    {hasInvalidInput && <p role="alert">Исправьте некорректные значения перед сохранением.</p>}
    {renderChoiceModal()}
  </div>;
};

export default CharacterCatalogAttributes;
